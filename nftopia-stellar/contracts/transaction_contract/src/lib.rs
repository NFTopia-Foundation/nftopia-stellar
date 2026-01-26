use soroban_sdk::{contracttype, Address, Bytes, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionState {
    Pending,
    Executed,
    Failed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Operation {
    pub name: Bytes,
    pub amount: i128,
    pub recipient: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Transaction {
    pub id: u64,
    pub owner: Address,
    pub operations: Vec<Operation>,
    pub state: TransactionState,
}
