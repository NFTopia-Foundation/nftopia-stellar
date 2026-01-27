use soroban_sdk::{Address, Bytes, Map, Vec};

#[derive(Clone)]
pub enum TransactionState {
    Draft,
    Pending,
    Executing,
    Completed,
    Failed,
    Cancelled,
    RolledBack,
}

#[derive(Clone)]
pub enum OperationType {
    NftMint,
    NftTransfer,
    MarketplaceList,
    PaymentTransfer,
}

#[derive(Clone)]
pub struct Operation {
    pub id: u64,
    pub operation_type: OperationType,
    pub target: Address,
    pub function: Bytes,
    pub parameters: Vec<Bytes>,
}

#[derive(Clone)]
pub struct Transaction {
    pub id: u64,
    pub creator: Address,
    pub operations: Vec<Operation>,
    pub state: TransactionState,
    pub metadata: Map<Bytes, Bytes>,
}
