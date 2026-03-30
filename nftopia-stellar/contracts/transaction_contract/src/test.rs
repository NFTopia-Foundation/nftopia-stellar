#![cfg(test)]

extern crate std;

use soroban_sdk::{Address, Env, String, Vec, map, vec};

use crate::{
    Operation, OperationType, ParamType, Parameter, TransactionContract, TransactionContractClient,
    TransactionState,
};

fn sample_operation(env: &Env, id: u64, deps: Vec<u64>) -> Operation {
    Operation {
        operation_id: id,
        operation_type: OperationType::NftMint,
        target_contract: Address::generate(env),
        function_name: String::from_str(env, "mint"),
        parameters: vec![env, Parameter {
            param_type: ParamType::Uint64,
            value: soroban_sdk::Bytes::from_slice(env, &id.to_be_bytes()),
        }],
        dependencies: deps,
        gas_limit: None,
        retry_count: 0,
        timeout_seconds: 300,
    }
}

#[test]
fn create_add_execute_transaction() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TransactionContract, ());
    let client = TransactionContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let metadata = map![&env, (String::from_str(&env, "workflow"), String::from_str(&env, "mint+list"))];

    let tx_id = client.create_transaction(&creator, &metadata, &vec![&env]);
    let op1 = sample_operation(&env, 1, vec![&env]);
    let op2 = sample_operation(&env, 2, vec![&env, 1]);

    client.add_operation(&tx_id, &op1);
    client.add_operation(&tx_id, &op2);

    let result = client.execute_transaction(&tx_id, &None, &None);
    assert_eq!(result.transaction_id, tx_id);
    assert_eq!(result.final_state, TransactionState::Completed);
    assert_eq!(result.successful_operations, 2);
}

#[test]
fn cancel_transaction_works() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TransactionContract, ());
    let client = TransactionContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    client.cancel_transaction(&tx_id, &String::from_str(&env, "user cancelled"));
    let status = client.get_transaction_status(&tx_id);

    assert_eq!(status.state, TransactionState::Cancelled);
}

#[test]
#[should_panic]
fn dependency_failure_panics_through_client() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TransactionContract, ());
    let client = TransactionContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // Operation 2 depends on non-existent op 99, so execution should fail.
    let bad_op = sample_operation(&env, 2, vec![&env, 99]);
    client.add_operation(&tx_id, &bad_op);

    let _ = client.execute_transaction(&tx_id, &None, &None);
}
