use soroban_sdk::{Address, Env, String, contractevent};

use crate::types::TransactionState;

#[contractevent]
#[derive(Clone, Debug)]
pub struct TransactionCreated {
    pub transaction_id: u64,
    pub creator: Address,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct TransactionStateChanged {
    pub transaction_id: u64,
    pub from_state: TransactionState,
    pub to_state: TransactionState,
}

#[contractevent]
#[derive(Clone, Debug)]
pub struct TransactionFailed {
    pub transaction_id: u64,
    pub reason: String,
}

/// Emitted when a pre-flight gas estimate deviates from the gas actually
/// metered by the host beyond the configured tolerance.  Consumers can use
/// these diagnostics to re-calibrate the on-chain fee parameters.
#[contractevent]
#[derive(Clone, Debug)]
pub struct GasEstimateDeviation {
    pub operation_id: u64,
    pub estimated_gas: u64,
    pub metered_gas: u64,
    pub deviation_bps: u32,
}

pub fn publish_created(env: &Env, transaction_id: u64, creator: &Address) {
    TransactionCreated {
        transaction_id,
        creator: creator.clone(),
    }
    .publish(env);
}

pub fn publish_state_changed(
    env: &Env,
    transaction_id: u64,
    from_state: &TransactionState,
    to_state: &TransactionState,
) {
    TransactionStateChanged {
        transaction_id,
        from_state: from_state.clone(),
        to_state: to_state.clone(),
    }
    .publish(env);
}

pub fn publish_failed(env: &Env, transaction_id: u64, reason: &String) {
    TransactionFailed {
        transaction_id,
        reason: reason.clone(),
    }
    .publish(env);
}

pub fn publish_gas_deviation(
    env: &Env,
    operation_id: u64,
    estimated_gas: u64,
    metered_gas: u64,
    deviation_bps: u32,
) {
    GasEstimateDeviation {
        operation_id,
        estimated_gas,
        metered_gas,
        deviation_bps,
    }
    .publish(env);
}
