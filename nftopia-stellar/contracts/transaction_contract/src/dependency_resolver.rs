//! Dependency resolution for transaction operations.
//!
//! The resolver is TTL-aware: before an operation is considered executable it
//! verifies that every dependency output still has enough TTL remaining to
//! cover the dependent operation's execution window plus a configurable
//! safety buffer. Execution order is produced by a deterministic topological
//! sort (Kahn's algorithm) over the explicit dependency graph, and cycles are
//! rejected with [`TransactionError::CircularDependencyError`].

use crate::error::TransactionError;
use crate::types::{Operation, OperationTtl, TtlConfig, default_ttl_config};
use crate::utils::time_manager;
use soroban_sdk::{Env, Map, Vec, contracttype};

/// Mainnet minimum TTL for temporary storage entries (ledgers).
pub const MAINNET_TEMP_MIN_TTL: u32 = time_manager::MAINNET_TEMP_MIN_TTL;

/// Mainnet maximum TTL for persistent storage entries (ledgers, ~30 days).
pub const MAINNET_PERSISTENT_MAX_TTL: u32 = time_manager::MAINNET_PERSISTENT_MAX_TTL;

/// Default ledger buffer that must remain after a dependent operation runs.
pub const DEFAULT_MIN_REMAINING_TTL_BUFFER: u32 = 1_000;

/// Instance-storage key for the admin-configurable TTL settings.
#[contracttype]
enum TtlKey {
    Config,
}

/// Precomputed dependency graph for a set of operations.
///
/// Building the graph validates that every referenced dependency is in scope
/// and that the graph is acyclic, then stores a deterministic topological
/// execution order plus the longest dependency chain depth.
#[derive(Debug)]
pub struct DependencyGraph {
    order: Vec<u64>,
    depth: u32,
    operations: Vec<Operation>,
}

impl DependencyGraph {
    /// Build a graph, detecting dangling references and cycles.
    pub fn build(env: &Env, operations: &Vec<Operation>) -> Result<Self, TransactionError> {
        let count = operations.len();

        let mut ids: Vec<u64> = Vec::new(env);
        for op in operations.iter() {
            ids.push_back(op.operation_id);
        }

        let mut in_degree: Map<u64, u32> = Map::new(env);
        let mut adjacency: Map<u64, Vec<u64>> = Map::new(env);
        for id in ids.iter() {
            in_degree.set(id, 0_u32);
        }

        for op in operations.iter() {
            let mut seen: Vec<u64> = Vec::new(env);
            for dep in op.dependencies.iter() {
                if seen.contains(dep) {
                    continue;
                }
                seen.push_back(dep);

                // A dependency must reference an operation in the same graph.
                if !in_degree.contains_key(dep) {
                    return Err(TransactionError::DependencyNotMet);
                }

                // Edge: dependency -> dependent operation.
                let mut children = adjacency.get(dep).unwrap_or_else(|| Vec::new(env));
                children.push_back(op.operation_id);
                adjacency.set(dep, children);

                let current = in_degree.get(op.operation_id).unwrap_or(0);
                in_degree.set(op.operation_id, current.saturating_add(1));
            }
        }

        // Kahn's algorithm with an insertion-order queue for determinism.
        let mut queue: Vec<u64> = Vec::new(env);
        for id in ids.iter() {
            if in_degree.get(id).unwrap_or(0) == 0 {
                queue.push_back(id);
            }
        }

        let mut order: Vec<u64> = Vec::new(env);
        let mut depth_map: Map<u64, u32> = Map::new(env);
        let mut head: u32 = 0;

        while head < queue.len() {
            let current = queue.get(head).unwrap();
            head += 1;
            order.push_back(current);

            let current_depth = depth_map.get(current).unwrap_or(0);
            let children = adjacency.get(current).unwrap_or_else(|| Vec::new(env));
            for child in children.iter() {
                let child_depth = depth_map.get(child).unwrap_or(0);
                let merged = child_depth.max(current_depth.saturating_add(1));
                depth_map.set(child, merged);

                let remaining = in_degree.get(child).unwrap_or(0).saturating_sub(1);
                in_degree.set(child, remaining);
                if remaining == 0 {
                    queue.push_back(child);
                }
            }
        }

        if order.len() != count {
            return Err(TransactionError::CircularDependencyError);
        }

        let mut depth: u32 = 0;
        for id in ids.iter() {
            depth = depth.max(depth_map.get(id).unwrap_or(0));
        }

        Ok(Self {
            order,
            depth,
            operations: operations.clone(),
        })
    }

    /// Operation IDs in dependency-safe execution order.
    pub fn operation_ids(&self) -> Vec<u64> {
        self.order.clone()
    }

    /// Operations in dependency-safe execution order.
    pub fn execution_order(&self) -> Vec<Operation> {
        let mut ordered: Vec<Operation> = Vec::new(self.operations.env());
        for id in self.order.iter() {
            for op in self.operations.iter() {
                if op.operation_id == id {
                    ordered.push_back(op);
                    break;
                }
            }
        }
        ordered
    }

    /// Longest dependency chain depth in the graph.
    pub fn max_depth(&self) -> u32 {
        self.depth
    }

    /// Validate that every declared execution window fits within the maximum
    /// persistent TTL window before any operation begins executing.
    pub fn validate_ttl_windows(&self, config: &TtlConfig) -> Result<(), TransactionError> {
        for op in self.operations.iter() {
            let window =
                time_manager::secs_to_ledgers(op.timeout_seconds, config.ledger_close_time_seconds);
            if window > config.persistent_entry_max_ttl {
                return Err(TransactionError::TTLExpired);
            }
        }
        Ok(())
    }
}

/// Returns true when all dependencies of `operation` are already completed.
///
/// This is the TTL-unaware predicate retained for callers that do not track
/// storage lifespans. Prefer [`validate_dependency_ttl`] when TTL data exists.
pub fn dependencies_satisfied(completed_operation_ids: &Vec<u64>, operation: &Operation) -> bool {
    for dep in operation.dependencies.iter() {
        if !completed_operation_ids.contains(dep) {
            return false;
        }
    }
    true
}

/// TTL-aware dependency predicate. Returns `false` when a dependency output
/// will expire before the dependent operation can complete.
pub fn dependencies_satisfied_with_ttl(
    env: &Env,
    completed_operation_ids: &Vec<u64>,
    completed_ttls: &Vec<OperationTtl>,
    operation: &Operation,
    config: &TtlConfig,
) -> bool {
    validate_dependency_ttl(
        env,
        completed_operation_ids,
        completed_ttls,
        operation,
        config,
    )
    .is_ok()
}

/// Validate dependencies for `operation` against completion flags and TTL.
///
/// Returns:
/// - `DependencyNotMet` if a dependency has not completed;
/// - `OperationTimedOut` if the operation's own deadline has passed;
/// - `TTLExpired` if a dependency output expires too soon.
pub fn validate_dependency_ttl(
    env: &Env,
    completed_operation_ids: &Vec<u64>,
    completed_ttls: &Vec<OperationTtl>,
    operation: &Operation,
    config: &TtlConfig,
) -> Result<(), TransactionError> {
    for dep in operation.dependencies.iter() {
        if !completed_operation_ids.contains(dep) {
            return Err(TransactionError::DependencyNotMet);
        }
    }

    let required_ledgers =
        time_manager::secs_to_ledgers(operation.timeout_seconds, config.ledger_close_time_seconds);
    let current_ledger = time_manager::current_ledger(env);

    for dep in operation.dependencies.iter() {
        let record = find_ttl(completed_ttls, dep);
        if let Some(record) = record {
            let remaining = remaining_ttl_ledgers(&record, current_ledger);
            time_manager::assert_ttl_sufficient(
                remaining,
                required_ledgers,
                config.min_remaining_ttl_buffer,
            )?;
        }
    }

    Ok(())
}

/// Remaining TTL (ledgers) for a completion record at `current_ledger`.
pub fn remaining_ttl_ledgers(record: &OperationTtl, current_ledger: u32) -> u32 {
    let elapsed = current_ledger.saturating_sub(record.satisfied_at_ledger);
    record.remaining_ttl_ledgers.saturating_sub(elapsed)
}

/// Renew a dependency's TTL so a dependent operation can be retried without
/// re-executing the entire transaction.
pub fn refresh_dependency(
    env: &Env,
    completed_ttls: &Vec<OperationTtl>,
    operation_id: u64,
    renewed_ttl_ledgers: u32,
) -> Result<Vec<OperationTtl>, TransactionError> {
    let mut updated: Vec<OperationTtl> = Vec::new(env);
    let mut found = false;

    for record in completed_ttls.iter() {
        if record.operation_id == operation_id {
            found = true;
            updated.push_back(OperationTtl {
                operation_id,
                satisfied_at_ledger: time_manager::current_ledger(env),
                remaining_ttl_ledgers: renewed_ttl_ledgers,
            });
        } else {
            updated.push_back(record);
        }
    }

    if !found {
        return Err(TransactionError::DependencyNotMet);
    }

    Ok(updated)
}

fn find_ttl(completed_ttls: &Vec<OperationTtl>, operation_id: u64) -> Option<OperationTtl> {
    completed_ttls
        .iter()
        .find(|record| record.operation_id == operation_id)
}

// ── TTL configuration ────────────────────────────────────────────────────────

/// Validate that TTL settings respect mainnet bounds.
pub fn validate_ttl_config(config: &TtlConfig) -> Result<(), TransactionError> {
    if config.temporary_entry_min_ttl < MAINNET_TEMP_MIN_TTL {
        return Err(TransactionError::InvalidOperation);
    }
    if config.persistent_entry_max_ttl > MAINNET_PERSISTENT_MAX_TTL {
        return Err(TransactionError::InvalidOperation);
    }
    if config.ledger_close_time_seconds == 0 {
        return Err(TransactionError::InvalidOperation);
    }
    Ok(())
}

/// Load the admin-configured TTL settings, falling back to mainnet defaults.
pub fn load_ttl_config(env: &Env) -> TtlConfig {
    env.storage()
        .instance()
        .get(&TtlKey::Config)
        .unwrap_or_else(|| default_ttl_config(env))
}

/// Persist admin-configured TTL settings after validating mainnet bounds.
pub fn save_ttl_config(env: &Env, config: &TtlConfig) -> Result<(), TransactionError> {
    validate_ttl_config(config)?;
    env.storage().instance().set(&TtlKey::Config, config);
    Ok(())
}

/// Deterministic topological execution order (cycles rejected).
pub fn resolve_execution_order(
    env: &Env,
    operations: &Vec<Operation>,
) -> Result<Vec<Operation>, TransactionError> {
    let graph = DependencyGraph::build(env, operations)?;
    Ok(graph.execution_order())
}
