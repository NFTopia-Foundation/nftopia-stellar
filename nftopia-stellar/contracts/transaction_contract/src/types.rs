use soroban_sdk::{Address, Bytes, Env, Map, String, Vec, contracttype};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionState {
    Draft,
    Pending,
    Executing,
    PartiallyComplete,
    Completed,
    Failed,
    Cancelled,
    RolledBack,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OperationType {
    NftMint,
    NftTransfer,
    NftApprove,
    MarketplaceList,
    MarketplaceBid,
    SettlementEscrow,
    SettlementRelease,
    PaymentTransfer,
    RoyaltyDistribution,
    MetadataUpdate,
    VerificationCheck,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ParamType {
    Address,
    Uint64,
    Int128,
    Text,
    Bytes,
    Bool,
    Array,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Parameter {
    pub param_type: ParamType,
    pub value: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignatureRecord {
    pub signer: Address,
    pub signature: Bytes,
    pub obtained_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SignatureType {
    Single,
    MultiSig(u32),
    Threshold((u32, u32)),
    TimeLocked(u64),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignatureRequirement {
    pub signer: Address,
    pub signature_type: SignatureType,
    pub required: bool,
    pub obtained: bool,
    pub obtained_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Operation {
    pub operation_id: u64,
    pub operation_type: OperationType,
    pub target_contract: Address,
    pub function_name: String,
    pub parameters: Vec<Parameter>,
    pub dependencies: Vec<u64>,
    pub gas_limit: Option<u64>,
    pub retry_count: u32,
    pub timeout_seconds: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OperationResult {
    pub operation_id: u64,
    pub success: bool,
    pub result_data: Option<Bytes>,
    pub gas_used: u64,
    pub error_message: Option<String>,
    pub executed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Transaction {
    pub transaction_id: u64,
    pub creator: Address,
    pub operations: Vec<Operation>,
    pub state: TransactionState,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub completed_at: Option<u64>,
    pub total_gas_used: u64,
    pub total_cost: i128,
    pub error_reason: Option<String>,
    pub rollback_operations: Vec<Operation>,
    pub signatures: Vec<SignatureRecord>,
    pub metadata: Map<String, String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasOptimizationConfig {
    pub batch_size: u32,
    pub max_parallel_operations: u32,
    pub gas_price_tolerance: u32,
    pub enable_reordering: bool,
    pub enable_caching: bool,
    pub fallback_gas_multiplier_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionBlueprint {
    pub creator: Address,
    pub metadata: Map<String, String>,
    pub initial_operations: Vec<Operation>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GasEstimate {
    pub estimated_gas: u64,
    pub estimated_cost: i128,
}

/// Mainnet Soroban fee-ladder parameters used to price a transaction.
///
/// The defaults mirror Stellar mainnet `ConfigSettingContractComputeV0`
/// (`feeRatePerInstructionsIncrement`) and
/// `ConfigSettingContractLedgerCostV0` (`feeReadLedgerEntry`,
/// `feeWriteLedgerEntry`, `feeRead1KB`, ...) plus the state-archival rent
/// settings.  Because the ledger fee configuration can be updated by network
/// validators, every field is admin-configurable on-chain and the values used
/// for a given estimate are stored alongside the contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NetworkFeeParams {
    /// Stroops charged per 10,000 CPU instructions (fee-ladder increment).
    pub stroops_per_10k_instructions: i128,
    /// Stroops charged per ledger entry read.
    pub stroops_per_read_entry: i128,
    /// Stroops charged per ledger entry write.
    pub stroops_per_write_entry: i128,
    /// Stroops charged per byte of ledger entry read.
    pub stroops_per_read_byte: i128,
    /// Stroops charged per byte of ledger entry written.
    pub stroops_per_write_byte: i128,
    /// Stroops charged per ledger of TTL extension (state archival rent).
    pub stroops_per_ttl_ledger: i128,
    /// Network congestion uplift in basis points (10,000 = no congestion).
    pub congestion_multiplier_bps: u32,
    /// Ledgers of TTL to buy for entries created or modified by an operation.
    pub ttl_extension_ledgers: u32,
}

/// Mainnet-recommended safety multiplier applied on top of the raw estimate.
/// Soroban fee rates are validator-configurable and can rise during
/// congestion; a 30% buffer (13,000 bps) avoids underpayment for typical
/// operations under normal network conditions.
pub const DEFAULT_MAINNET_GAS_MULTIPLIER_BPS: u32 = 13_000;

/// Upper bound accepted for the admin-configurable safety multiplier.
pub const MAX_GAS_MULTIPLIER_BPS: u32 = 20_000;

/// Lower bound accepted for the admin-configurable safety multiplier.
pub const MIN_GAS_MULTIPLIER_BPS: u32 = 10_000;

/// Default mainnet fee parameters, sourced from the Stellar mainnet ledger
/// configuration (see `gas_calculator.rs` module docs for references).
pub fn default_network_fee_params() -> NetworkFeeParams {
    NetworkFeeParams {
        stroops_per_10k_instructions: 25,
        stroops_per_read_entry: 6_250,
        stroops_per_write_entry: 10_000,
        stroops_per_read_byte: 1_786,
        stroops_per_write_byte: 1_786,
        stroops_per_ttl_ledger: 1,
        congestion_multiplier_bps: 10_000,
        ttl_extension_ledgers: 100,
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecutionResult {
    pub transaction_id: u64,
    pub final_state: TransactionState,
    pub successful_operations: u32,
    pub failed_operations: u32,
    pub total_gas_used: u64,
    pub results: Vec<OperationResult>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchExecutionResult {
    pub total_transactions: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub result_ids: Vec<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryResult {
    pub transaction_id: u64,
    pub recovered: bool,
    pub message: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RecoveryStrategy {
    Retry,
    Rollback,
    Cancel,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionStatus {
    pub transaction_id: u64,
    pub state: TransactionState,
    pub completed_operations: u32,
    pub total_operations: u32,
    pub error_reason: Option<String>,
}

pub fn default_gas_config(_env: &Env) -> GasOptimizationConfig {
    GasOptimizationConfig {
        batch_size: 10,
        max_parallel_operations: 1,
        gas_price_tolerance: 20,
        enable_reordering: false,
        enable_caching: false,
        fallback_gas_multiplier_bps: DEFAULT_MAINNET_GAS_MULTIPLIER_BPS,
    }
}
