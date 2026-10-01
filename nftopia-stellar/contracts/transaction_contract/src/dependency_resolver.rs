//! Topological dependency resolution plus mainnet state-liveness (TTL)
//! validation (#290).
//!
//! # Ordering
//!
//! `resolve_execution_order` previously returned the operations in insertion
//! order, which silently produced *wrong* results whenever a dependency was
//! listed after its dependent. It now performs a Kahn topological sort and
//! reports a cycle as [`TransactionError::CircularDependency`] instead of
//! looping forever. Ties are broken deterministically so that every node of the
//! network — and every simulation — derives the same order.
//!
//! # State liveness
//!
//! A Soroban transaction is only valid while every entry in its read/write
//! footprint is still live. Persistent entries expire after at most
//! [`MAINNET_MAX_ENTRY_TTL`] ledgers and, more importantly, after the
//! *minimum* window of [`MAINNET_MIN_PERSISTENT_ENTRY_TTL`] ledgers if nobody
//! bumps them. Long-running transactions (multi-day escrow settlements, batched
//! royalty runs) therefore have to keep their own state alive, and doing so
//! costs rent — see [`crate::utils::gas_calculator::ttl_refresh_resources`].
//!
//! Contracts cannot read the network's TTL limits (`Env` exposes only
//! `storage().max_ttl()`, `ledger().sequence()` and `ledger().timestamp()`), so
//! the calibration lives in [`TtlPolicy`]: mainnet-accurate defaults, refreshable
//! by the admin via `transaction_core::set_ttl_policy`.

use crate::error::TransactionError;
use crate::security::resource_guard::MAX_DEPENDENCY_DEPTH;
use crate::types::Operation;
use soroban_sdk::{Address, Env, Map, Vec, contracttype};

// ── Mainnet TTL calibration ──────────────────────────────────────────────
/// Minimum number of ledgers a freshly written persistent entry is guaranteed to
/// stay live (`minPersistentEntryTTL` in the network settings).
pub const MAINNET_MIN_PERSISTENT_ENTRY_TTL: u32 = 4_096;
/// Maximum lifetime of a persistent entry (`maxEntryTTL`, ≈ 30 days at 6 s).
pub const MAINNET_MAX_ENTRY_TTL: u32 = 518_400;
/// Minimum lifetime the network grants a temporary entry.
pub const MAINNET_MIN_TEMPORARY_ENTRY_TTL: u32 = 4_096;
/// Observed Pubnet average ledger close time, in seconds.
pub const MAINNET_AVG_LEDGER_CLOSE_SECONDS: u64 = 6;
/// Fail a run when an entry has less than this many ledgers of liveness left.
pub const DEFAULT_MIN_REMAINING_TTL_LEDGERS: u32 = 2_000;
/// Bump state this far forward by default (≈ 12 days at 6 s ledgers).
pub const DEFAULT_TTL_EXTEND_TO_LEDGERS: u32 = 172_800;
/// Longest transaction window operators may configure (≈ 2 days).
pub const MAX_TRANSACTION_WINDOW_SECONDS: u64 = 2 * 24 * 60 * 60;
/// Freshness-scope id of the transaction record itself (operations use their
/// own operation id).
pub const TRANSACTION_LIVE_SCOPE: u64 = 0;

/// Ledger-based liveness policy for transaction state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TtlPolicy {
    /// Refuse to start or continue a run while an entry has fewer ledgers left.
    pub min_remaining_ttl_ledgers: u32,
    /// Bump entries up to this many ledgers of remaining liveness.
    pub extend_to_ledgers: u32,
    /// Liveness a freshly created entry can be assumed to have (network minimum).
    pub min_entry_ttl_ledgers: u32,
    /// Hard ceiling enforced by the network (`maxEntryTTL`).
    pub max_entry_ttl_ledgers: u32,
    /// Calibration used to turn wall-clock windows into ledger distances.
    pub avg_ledger_close_seconds: u64,
    /// Longest wall-clock window a transaction may declare.
    pub max_transaction_seconds: u64,
}

impl Default for TtlPolicy {
    fn default() -> Self {
        TtlPolicy {
            min_remaining_ttl_ledgers: DEFAULT_MIN_REMAINING_TTL_LEDGERS,
            extend_to_ledgers: DEFAULT_TTL_EXTEND_TO_LEDGERS,
            min_entry_ttl_ledgers: MAINNET_MIN_PERSISTENT_ENTRY_TTL,
            max_entry_ttl_ledgers: MAINNET_MAX_ENTRY_TTL,
            avg_ledger_close_seconds: MAINNET_AVG_LEDGER_CLOSE_SECONDS,
            max_transaction_seconds: MAX_TRANSACTION_WINDOW_SECONDS,
        }
    }
}

impl TtlPolicy {
    /// Reject policies the network could not honour.
    pub fn validate(&self) -> Result<(), TransactionError> {
        if self.avg_ledger_close_seconds == 0
            || self.avg_ledger_close_seconds > 60
            || self.min_remaining_ttl_ledgers == 0
            || self.extend_to_ledgers < self.min_remaining_ttl_ledgers
            || self.min_entry_ttl_ledgers == 0
            || self.max_entry_ttl_ledgers < self.extend_to_ledgers
            || self.max_entry_ttl_ledgers > MAINNET_MAX_ENTRY_TTL
            || self.max_transaction_seconds == 0
            || self.max_transaction_seconds > MAX_TRANSACTION_WINDOW_SECONDS
        {
            return Err(TransactionError::InvalidConfiguration);
        }
        Ok(())
    }

    /// Convert a wall-clock window into the number of ledgers it spans
    /// (rounded up, saturating at `u32::MAX`).
    pub fn seconds_to_ledgers(&self, seconds: u64) -> u32 {
        if seconds == 0 {
            return 0;
        }
        let ledgers = seconds
            .saturating_add(self.avg_ledger_close_seconds - 1)
            .saturating_div(self.avg_ledger_close_seconds);
        if ledgers > u32::MAX as u64 {
            u32::MAX
        } else {
            ledgers as u32
        }
    }

    /// Convert a ledger distance back into seconds.
    pub fn ledgers_to_seconds(&self, ledgers: u32) -> u64 {
        (ledgers as u64).saturating_mul(self.avg_ledger_close_seconds)
    }

    /// Ceiling applied to any TTL bump: never ask the host for more than the
    /// network (or this policy) allows.
    pub fn clamp_extend_to(&self, env: &Env) -> u32 {
        let network_max = env.storage().max_ttl();
        self.extend_to_ledgers
            .min(self.max_entry_ttl_ledgers)
            .min(network_max.max(1))
    }
}

/// Storage keys owned by the resolver.
#[derive(Clone)]
#[contracttype]
pub enum ResolverKey {
    TtlPolicyConfig,
    // tx_id -> (freshness scope -> ledger through which that entry is live)
    LiveUntil(u64),
}

/// Read the active TTL policy, falling back to the mainnet defaults.
pub fn get_ttl_policy(env: &Env) -> TtlPolicy {
    env.storage()
        .instance()
        .get(&ResolverKey::TtlPolicyConfig)
        .unwrap_or_default()
}

/// Install a refreshed policy (authorisation is checked by the caller).
pub fn set_ttl_policy(env: &Env, policy: &TtlPolicy) -> Result<(), TransactionError> {
    policy.validate()?;
    env.storage()
        .instance()
        .set(&ResolverKey::TtlPolicyConfig, policy);
    Ok(())
}

/// Forget the operator override and go back to mainnet defaults.
pub fn reset_ttl_policy(env: &Env) {
    env.storage()
        .instance()
        .remove(&ResolverKey::TtlPolicyConfig);
}

/// Remember that `scope` is guaranteed live through `live_until_ledger`.
///
/// The recorded value is a *lower bound*: it is only ever written by
/// [`extend_transaction_state`], which never over-states liveness (see the
/// soundness argument there).
///
/// The stamp's own TTL is deliberately left at the fresh-write minimum instead
/// of being bumped alongside the state it describes. A stamp therefore expires
/// *before* the entry it vouches for, which means a stale stamp can only ever
/// cause an unnecessary (idempotent) refresh — never a false claim that an
/// entry is still live.
pub fn record_liveness(env: &Env, tx_id: u64, scope: u64, live_until_ledger: u32) {
    let key = ResolverKey::LiveUntil(tx_id);
    let mut stamps: Map<u64, u32> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Map::new(env));
    let current = stamps.get(scope).unwrap_or(0);
    if live_until_ledger > current {
        stamps.set(scope, live_until_ledger);
        env.storage().persistent().set(&key, &stamps);
    }
}

/// The ledger through which `scope`'s entry is provably live, if known.
pub fn live_until_ledger(env: &Env, tx_id: u64, scope: u64) -> Option<u32> {
    let stamps: Map<u64, u32> = env
        .storage()
        .persistent()
        .get(&ResolverKey::LiveUntil(tx_id))?;
    let stamp = stamps.get(scope)?;
    let now = env.ledger().sequence();
    if stamp > now { Some(stamp) } else { None }
}

/// Ledgers of proven liveness left for `scope` (`0` when nothing is known).
pub fn remaining_live_ledgers(env: &Env, tx_id: u64, scope: u64) -> u32 {
    match live_until_ledger(env, tx_id, scope) {
        Some(until) => until.saturating_sub(env.ledger().sequence()),
        None => 0,
    }
}

/// Freshness-scope id of the shared operation-map entry.
pub const OPERATIONS_LIVE_SCOPE: u64 = u64::MAX;

/// Bump the transaction record and its operation map, and record the liveness
/// that was bought.
///
/// # Why `sequence + extend_to` is a sound lower bound
///
/// The host only exposes `extend_ttl(key, threshold, extend_to)` (reading a
/// live TTL back is not available to contracts). With `threshold == extend_to`
/// both of its branches leave at least `extend_to` ledgers: when the remaining
/// liveness is below the target it is raised *to* the target, and when it is not
/// below the target it already had at least that much. Recording
/// `ledger().sequence() + extend_to` therefore never over-states liveness, and
/// the call is idempotent.
pub fn extend_transaction_state(
    env: &Env,
    tx_id: u64,
    policy: &TtlPolicy,
) -> Result<u32, TransactionError> {
    let extend_to = policy.clamp_extend_to(env);
    if extend_to < policy.min_remaining_ttl_ledgers {
        // The network would cap the bump below the safety margin: the policy
        // cannot be honoured here, which is a configuration problem, not a
        // caller error.
        return Err(TransactionError::InvalidConfiguration);
    }

    let live_until_ledger = env.ledger().sequence().saturating_add(extend_to);
    if !crate::tx_storage::extend_transaction_ttl(env, tx_id, extend_to, extend_to) {
        return Err(TransactionError::TransactionNotFound);
    }
    record_liveness(env, tx_id, TRANSACTION_LIVE_SCOPE, live_until_ledger);

    // A transaction without operations has no operation map to keep alive.
    if crate::storage::operation_store::extend_ttl(env, tx_id, extend_to, extend_to) {
        record_liveness(env, tx_id, OPERATIONS_LIVE_SCOPE, live_until_ledger);
    }

    Ok(live_until_ledger)
}

/// Ledgers of liveness still needed to finish a run of `operations`.
///
/// Every operation may be driven by its own wall-clock `timeout_seconds`, and
/// an interactive flow needs at least one ledger per operation, so the
/// requirement is the larger of the two.
pub fn ledgers_required_to_completion(operations: &Vec<Operation>, policy: &TtlPolicy) -> u32 {
    let mut timeout_ledgers = 0u32;
    for op in operations.iter() {
        timeout_ledgers = timeout_ledgers.max(policy.seconds_to_ledgers(op.timeout_seconds));
    }
    timeout_ledgers.max(operations.len())
}

/// Fail closed unless every scope listed is provably live for
/// `policy.min_remaining_ttl_ledgers + extra_ledgers` more ledgers.
pub fn assert_state_live(
    env: &Env,
    tx_id: u64,
    scopes: &Vec<u64>,
    extra_ledgers: u32,
    policy: &TtlPolicy,
) -> Result<(), TransactionError> {
    let required = policy
        .min_remaining_ttl_ledgers
        .saturating_add(extra_ledgers);
    for scope in scopes.iter() {
        if remaining_live_ledgers(env, tx_id, scope) < required {
            return Err(TransactionError::TtlExpired);
        }
    }
    Ok(())
}

/// Scopes that must stay live while a transaction executes: its record, plus
/// the shared operation-map entry when the transaction has one (#290).
pub fn required_live_scopes(env: &Env, tx_id: u64) -> Vec<u64> {
    let mut scopes = Vec::new(env);
    scopes.push_back(TRANSACTION_LIVE_SCOPE);
    if crate::storage::operation_store::exists(env, tx_id) {
        scopes.push_back(OPERATIONS_LIVE_SCOPE);
    }
    scopes
}

/// Resolve the execution order *and* make sure the state backing it will still
/// be there when the last operation lands (#290).
///
/// Liveness is refreshed automatically when it has decayed below what the run
/// needs; if even a fresh bump cannot cover the declared timeouts the caller
/// gets [`TransactionError::TtlExpired`] and must shorten the timeouts or the
/// policy.
pub fn prepare_execution(
    env: &Env,
    tx_id: u64,
    operations: &Vec<Operation>,
) -> Result<DependencyGraph, TransactionError> {
    let policy = get_ttl_policy(env);
    let graph = DependencyGraph::build(env, operations)?;
    let required = ledgers_required_to_completion(operations, &policy);
    let scopes = required_live_scopes(env, tx_id);

    if assert_state_live(env, tx_id, &scopes, required, &policy).is_err() {
        extend_transaction_state(env, tx_id, &policy)?;
        // A bump is bounded by `max_entry_ttl`; re-check instead of assuming it
        // was enough.
        let scopes = required_live_scopes(env, tx_id);
        assert_state_live(env, tx_id, &scopes, required, &policy)?;
    }

    Ok(graph)
}

/// Strategy used to pick between operations that are ready at the same time.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SelectionStrategy {
    /// Always run the lowest operation id first — the most predictable order
    /// for callers and for simulations.
    LowestId,
    /// Prefer an operation that targets the same contract as the operation that
    /// just ran: consecutive calls against one contract reuse the already
    /// loaded instance entry, the single most expensive read in
    /// [`crate::utils::gas_calculator`].
    TargetLocality,
}

/// A resolved, cycle-free execution plan.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DependencyGraph {
    /// Operations in the order they must be executed in.
    pub operations: Vec<Operation>,
    /// The same ordering, as operation ids.
    pub order: Vec<u64>,
    /// Longest dependency chain, counted in operations (`1` for a single
    /// operation without dependencies).
    pub depth: u32,
}

impl DependencyGraph {
    /// Resolve with the deterministic lowest-id-first tie-break.
    pub fn build(env: &Env, operations: &Vec<Operation>) -> Result<Self, TransactionError> {
        Self::build_with(env, operations, SelectionStrategy::LowestId)
    }

    /// Resolve while clustering operations that hit the same target contract.
    pub fn build_clustered(
        env: &Env,
        operations: &Vec<Operation>,
    ) -> Result<Self, TransactionError> {
        Self::build_with(env, operations, SelectionStrategy::TargetLocality)
    }

    /// Kahn topological sort over the dependency edges.
    ///
    /// Complexity is `O(V^2 + E)` with `V <= MAX_OPERATIONS_PER_TRANSACTION`
    /// (50), which is both bounded and free of the recursion a DFS would need
    /// on a metered, stack-limited host.
    pub fn build_with(
        env: &Env,
        operations: &Vec<Operation>,
        strategy: SelectionStrategy,
    ) -> Result<Self, TransactionError> {
        let mut by_id: Map<u64, Operation> = Map::new(env);
        let mut indegree: Map<u64, u32> = Map::new(env);
        let mut dependents: Map<u64, Vec<u64>> = Map::new(env);
        let mut depth_of: Map<u64, u32> = Map::new(env);
        let mut unresolved: Vec<u64> = Vec::new(env);
        // Pass 1 — index every operation and reject ids that cannot resolve.
        for op in operations.iter() {
            let id = op.operation_id;
            if id == 0 {
                return Err(TransactionError::InvalidOperation);
            }
            if by_id.contains_key(id) {
                return Err(TransactionError::DuplicateOperationId);
            }
            by_id.set(id, op.clone());
            indegree.set(id, 0);
            dependents.set(id, Vec::new(env));
            depth_of.set(id, 1);
            unresolved.push_back(id);
        }

        // Pass 2 — build the edges, de-duplicating parallel edges so that
        // `dependencies = [1, 1]` cannot wedge the in-degree counter.
        for op in operations.iter() {
            let mut seen: Vec<u64> = Vec::new(env);
            let mut degree = 0u32;
            for dep in op.dependencies.iter() {
                if dep == op.operation_id {
                    // A self-dependency is the smallest possible cycle.
                    return Err(TransactionError::CircularDependency);
                }
                if !by_id.contains_key(dep) {
                    // A dependency outside this transaction can never be met.
                    return Err(TransactionError::DependencyNotMet);
                }
                if seen.contains(dep) {
                    continue;
                }
                seen.push_back(dep);
                degree = degree.saturating_add(1);
                let mut list = dependents.get(dep).unwrap_or_else(|| Vec::new(env));
                list.push_back(op.operation_id);
                dependents.set(dep, list);
            }
            indegree.set(op.operation_id, degree);
        }

        let mut ordered_operations: Vec<Operation> = Vec::new(env);
        let mut order: Vec<u64> = Vec::new(env);
        let mut depth = 0u32;
        let mut previous_target: Option<Address> = None;

        while !unresolved.is_empty() {
            let mut chosen: Option<u32> = None;
            let mut index = 0u32;
            while index < unresolved.len() {
                let candidate = match unresolved.get(index) {
                    Some(id) => id,
                    None => {
                        index = index.saturating_add(1);
                        continue;
                    }
                };
                let ready = indegree.get(candidate).unwrap_or(1) == 0;
                if ready {
                    let take = match chosen {
                        None => true,
                        Some(best_index) => match unresolved.get(best_index) {
                            Some(best) => {
                                prefer(candidate, best, &by_id, &previous_target, strategy)
                            }
                            None => true,
                        },
                    };
                    if take {
                        chosen = Some(index);
                    }
                }
                index = index.saturating_add(1);
            }

            // Nothing is ready while operations are still unresolved: with
            // de-duplicated edges that can only mean a cycle.
            let best_index = match chosen {
                Some(index) => index,
                None => return Err(TransactionError::CircularDependency),
            };
            let id = match unresolved.get(best_index) {
                Some(id) => id,
                None => return Err(TransactionError::CircularDependency),
            };
            let op = match by_id.get(id) {
                Some(op) => op,
                None => return Err(TransactionError::TransactionNotFound),
            };

            let op_depth = depth_of.get(id).unwrap_or(1);
            depth = depth.max(op_depth);
            unresolved.remove(best_index);
            ordered_operations.push_back(op.clone());
            order.push_back(id);
            previous_target = Some(op.target_contract.clone());

            if let Some(dependent_list) = dependents.get(id) {
                for dependent in dependent_list.iter() {
                    let child_depth = op_depth.saturating_add(1);
                    if child_depth > depth_of.get(dependent).unwrap_or(0) {
                        depth_of.set(dependent, child_depth);
                    }
                    let left = indegree.get(dependent).unwrap_or(0).saturating_sub(1);
                    indegree.set(dependent, left);
                }
            }
        }

        if depth > MAX_DEPENDENCY_DEPTH {
            return Err(TransactionError::ResourceLimitExceeded);
        }

        Ok(DependencyGraph {
            operations: ordered_operations,
            order,
            depth,
        })
    }

    pub fn len(&self) -> u32 {
        self.operations.len()
    }

    pub fn is_empty(&self) -> bool {
        self.operations.is_empty()
    }
}

/// Should `candidate` be executed before `best`?
fn prefer(
    candidate: u64,
    best: u64,
    by_id: &Map<u64, Operation>,
    previous_target: &Option<Address>,
    strategy: SelectionStrategy,
) -> bool {
    match strategy {
        SelectionStrategy::LowestId => candidate < best,
        SelectionStrategy::TargetLocality => {
            if let Some(previous) = previous_target {
                let candidate_matches = targets(candidate, by_id).as_ref() == Some(previous);
                let best_matches = targets(best, by_id).as_ref() == Some(previous);
                if candidate_matches != best_matches {
                    return candidate_matches;
                }
            }
            candidate < best
        }
    }
}

fn targets(id: u64, by_id: &Map<u64, Operation>) -> Option<Address> {
    by_id.get(id).map(|op| op.target_contract)
}

/// Back-compatible helper: the resolved order as a plain vector.
pub fn resolve_execution_order(
    env: &Env,
    operations: &Vec<Operation>,
) -> Result<Vec<Operation>, TransactionError> {
    Ok(DependencyGraph::build(env, operations)?.operations)
}

/// Returns true when all dependencies of `operation` are already completed.
pub fn dependencies_satisfied(completed_operation_ids: &Vec<u64>, operation: &Operation) -> bool {
    for dep in operation.dependencies.iter() {
        if !completed_operation_ids.contains(dep) {
            return false;
        }
    }
    true
}
