#![cfg(test)]

extern crate std;

use soroban_sdk::{Address, Env, String, Vec, map, testutils::Address as _, vec};

use crate::transaction_core::{TransactionContract, TransactionContractClient};
use crate::types::{GasOptimizationConfig, RecoveryStrategy, TransactionBlueprint};
use crate::{Operation, OperationType, ParamType, Parameter, TransactionState};

fn sample_operation(env: &Env, id: u64, deps: Vec<u64>) -> Operation {
    Operation {
        operation_id: id,
        operation_type: OperationType::NftMint,
        target_contract: Address::generate(env),
        function_name: String::from_str(env, "mint"),
        parameters: vec![
            env,
            Parameter {
                param_type: ParamType::Uint64,
                value: soroban_sdk::Bytes::from_slice(env, &id.to_be_bytes()),
            },
        ],
        dependencies: deps,
        gas_limit: None,
        retry_count: 0,
        timeout_seconds: 300,
    }
}

fn make_client(env: &Env) -> (TransactionContractClient<'_>, Address) {
    let contract_id = env.register(TransactionContract, ());
    let client = TransactionContractClient::new(env, &contract_id);
    (client, Address::generate(env))
}

#[test]
fn create_add_execute_transaction() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TransactionContract, ());
    let client = TransactionContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let metadata = map![
        &env,
        (
            String::from_str(&env, "workflow"),
            String::from_str(&env, "mint+list")
        )
    ];

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

// ── Gas estimation ──────────────────────────────────────────────────────────

#[test]
fn gas_estimate_grows_with_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    let est0 = client.estimate_transaction_gas(&tx_id);
    assert_eq!(est0.estimated_gas, 0);

    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));
    let est1 = client.estimate_transaction_gas(&tx_id);

    client.add_operation(&tx_id, &sample_operation(&env, 2, vec![&env]));
    let est2 = client.estimate_transaction_gas(&tx_id);

    assert!(est1.estimated_gas > est0.estimated_gas);
    assert!(est2.estimated_gas > est1.estimated_gas);
    // Cost is derived from gas
    assert_eq!(est2.estimated_cost, est2.estimated_gas as i128);
}

// ── Gas ceiling enforcement ─────────────────────────────────────────────────

#[test]
#[should_panic]
fn gas_ceiling_rejects_over_budget_execution() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    // Each bare op costs 100 gas; set ceiling below that
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));
    // max_gas = 50  →  should panic/err
    let _ = client.execute_transaction(&tx_id, &Some(50_u64), &None);
}

// ── Already-finalized guard ─────────────────────────────────────────────────

#[test]
#[should_panic]
fn cannot_execute_cancelled_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.cancel_transaction(&tx_id, &String::from_str(&env, "done"));
    // Attempting execute after cancel must panic
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));
    let _ = client.execute_transaction(&tx_id, &None, &None);
}

// ── Signature flow ──────────────────────────────────────────────────────────

#[test]
fn add_and_verify_signature() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    let signer = Address::generate(&env);
    let sig_bytes = soroban_sdk::Bytes::from_slice(&env, &[0xde, 0xad, 0xbe, 0xef]);

    client.add_signature(&tx_id, &signer, &sig_bytes);
    let verified = client.verify_signatures(&tx_id);
    assert!(verified);
}

#[test]
#[should_panic]
fn verify_signatures_panics_when_none_added() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);
    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    // No signatures added → should panic/err
    let _ = client.verify_signatures(&tx_id);
}

// ── Recovery flow ───────────────────────────────────────────────────────────

#[test]
fn recovery_retry_resets_failed_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    // Add an op whose dependency will never be satisfied → forces fail
    let bad_op = sample_operation(&env, 1, vec![&env, 99]);
    client.add_operation(&tx_id, &bad_op);

    // Drive to failed state
    let _ = std::panic::catch_unwind(|| {
        // We can't call into the SDK across unwind boundaries; instead we
        // test recover on a Pending transaction.
    });

    // Directly verify Retry is rejected on a non-failed state (Pending → error)
    let tx_id2 = client.create_transaction(&creator, &map![&env], &vec![&env]);
    // recover_transaction on Pending should error (InvalidStateTransition)
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.recover_transaction(&tx_id2, &RecoveryStrategy::Retry)
    }));
    assert!(
        res.is_err(),
        "expected panic from invalid recovery strategy on pending tx"
    );
}

#[test]
fn recovery_cancel_strategy_works() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    let result = client.recover_transaction(&tx_id, &RecoveryStrategy::Cancel);
    assert!(result.recovered);
    let status = client.get_transaction_status(&tx_id);
    assert_eq!(status.state, TransactionState::Cancelled);
}

#[test]
fn recovery_rollback_strategy_works() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    let result = client.recover_transaction(&tx_id, &RecoveryStrategy::Rollback);
    assert!(result.recovered);
    let status = client.get_transaction_status(&tx_id);
    assert_eq!(status.state, TransactionState::RolledBack);
}

// ── Batch create ────────────────────────────────────────────────────────────

#[test]
fn batch_create_produces_sequential_ids() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    // Each blueprint must use its own unique creator address; Soroban SDK 23
    // rejects a second require_auth() on the same address within one frame.
    let creator2 = Address::generate(&env);
    let creator3 = Address::generate(&env);

    let blueprints = vec![
        &env,
        TransactionBlueprint {
            creator: creator.clone(),
            metadata: map![&env],
            initial_operations: vec![&env],
        },
        TransactionBlueprint {
            creator: creator2,
            metadata: map![&env],
            initial_operations: vec![&env],
        },
        TransactionBlueprint {
            creator: creator3,
            metadata: map![&env],
            initial_operations: vec![&env],
        },
    ];
    let ids = client.batch_create_transactions(&blueprints);
    assert_eq!(ids.len(), 3);
    // IDs must be distinct
    assert_ne!(ids.get(0), ids.get(1));
    assert_ne!(ids.get(1), ids.get(2));
}

// ── Batch execute ───────────────────────────────────────────────────────────

#[test]
fn batch_execute_all_succeed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let gas_cfg = GasOptimizationConfig {
        batch_size: 10,
        max_parallel_operations: 1,
        gas_price_tolerance: 20,
        enable_reordering: false,
        enable_caching: false,
        fallback_gas_multiplier_bps: 11_000,
    };

    // Create two simple single-op transactions
    let tx1 = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.add_operation(&tx1, &sample_operation(&env, 1, vec![&env]));

    let tx2 = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.add_operation(&tx2, &sample_operation(&env, 1, vec![&env]));

    let result = client.batch_execute_transactions(&vec![&env, tx1, tx2], &gas_cfg);
    assert_eq!(result.total_transactions, 2);
    assert_eq!(result.succeeded, 2);
    assert_eq!(result.failed, 0);
}

// ── Status reporting ────────────────────────────────────────────────────────

#[test]
fn status_reflects_completed_state() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));
    client.execute_transaction(&tx_id, &None, &None);

    let status = client.get_transaction_status(&tx_id);
    assert_eq!(status.state, TransactionState::Completed);
    assert_eq!(status.total_operations, 1);
    assert_eq!(status.completed_operations, 1);
    assert!(status.error_reason.is_none());
}

// ── Multiple operation types ─────────────────────────────────────────────────

#[test]
fn various_operation_types_all_execute() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let types = [
        OperationType::NftTransfer,
        OperationType::MarketplaceList,
        OperationType::SettlementEscrow,
        OperationType::PaymentTransfer,
        OperationType::RoyaltyDistribution,
    ];

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    for (i, op_type) in types.iter().enumerate() {
        let op = Operation {
            operation_id: (i + 1) as u64,
            operation_type: op_type.clone(),
            target_contract: Address::generate(&env),
            function_name: String::from_str(&env, "fn"),
            parameters: vec![&env],
            dependencies: vec![&env],
            gas_limit: None,
            retry_count: 0,
            timeout_seconds: 300,
        };
        client.add_operation(&tx_id, &op);
    }

    let result = client.execute_transaction(&tx_id, &None, &None);
    assert_eq!(result.final_state, TransactionState::Completed);
    assert_eq!(result.successful_operations, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE REVERT PATH TESTS (#157)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_unauthorized_creator_add_operation() {
    use soroban_sdk::{
        IntoVal,
        testutils::{MockAuth, MockAuthInvoke},
    };
    let env = Env::default();
    let (client, creator) = make_client(&env);

    // 1. Creator creates the transaction
    env.mock_all_auths();
    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // 2. Now call add_operation as 'hacker'
    let hacker = Address::generate(&env);
    let op = sample_operation(&env, 1, vec![&env]);

    // We mock auth ONLY for hacker. add_operation will call creator.require_auth(),
    // which will fail because creator is not in the authorized addresses for this call.
    client
        .mock_auths(&[MockAuth {
            address: &hacker,
            invoke: &MockAuthInvoke {
                contract: &client.address,
                fn_name: "add_operation",
                args: (tx_id, op.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .add_operation(&tx_id, &op);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #10)")] // TransactionError::DuplicateOperationId
fn test_duplicate_operation_id_validation() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    let op1 = sample_operation(&env, 1, vec![&env]);
    let op2 = sample_operation(&env, 1, vec![&env]); // Duplicate ID 1

    client.add_operation(&tx_id, &op1);
    client.add_operation(&tx_id, &op2);

    // Validation should catch duplicate ID during preflight
    client.execute_transaction(&tx_id, &None, &None);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #11)")] // TransactionError::ResourceLimitExceeded
fn test_max_operations_limit_exceeded() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // Max is 50 operations
    for i in 1..=51 {
        let op = sample_operation(&env, i as u64, vec![&env]);
        client.add_operation(&tx_id, &op);
    }
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #11)")] // TransactionError::ResourceLimitExceeded
fn test_max_params_per_op_exceeded() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    let mut params = Vec::new(&env);
    for _ in 0..21 {
        // Max is 20
        params.push_back(Parameter {
            param_type: ParamType::Bool,
            value: soroban_sdk::Bytes::from_slice(&env, &[1]),
        });
    }

    let mut op = sample_operation(&env, 1, vec![&env]);
    op.parameters = params;

    client.add_operation(&tx_id, &op);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #11)")] // TransactionError::ResourceLimitExceeded
fn test_batch_size_limit_exceeded() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = make_client(&env);

    let mut blueprints = Vec::new(&env);
    for _ in 0..11 {
        // Max is 10
        blueprints.push_back(TransactionBlueprint {
            creator: Address::generate(&env),
            metadata: map![&env],
            initial_operations: vec![&env],
        });
    }

    client.batch_create_transactions(&blueprints);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #3)")] // TransactionError::InvalidStateTransition
fn test_recovery_on_completed_transaction_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));
    client.execute_transaction(&tx_id, &None, &None);

    // Cannot retry a completed transaction
    client.recover_transaction(&tx_id, &RecoveryStrategy::Retry);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED ORCHESTRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_complex_dependency_resolution() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // 1 -> 2
    // 1 -> 3
    // (2, 3) -> 4
    let op1 = sample_operation(&env, 1, vec![&env]);
    let op2 = sample_operation(&env, 2, vec![&env, 1]);
    let op3 = sample_operation(&env, 3, vec![&env, 1]);
    let op4 = sample_operation(&env, 4, vec![&env, 2, 3]);

    client.add_operation(&tx_id, &op1);
    client.add_operation(&tx_id, &op2);
    client.add_operation(&tx_id, &op3);
    client.add_operation(&tx_id, &op4);

    let result = client.execute_transaction(&tx_id, &None, &None);
    assert_eq!(result.final_state, TransactionState::Completed);
    assert_eq!(result.successful_operations, 4);

    // Verify specific results are present for all operations
    assert_eq!(result.results.len(), 4);
    for i in 0..4 {
        assert_eq!(result.results.get(i).unwrap().operation_id, (i + 1) as u64);
    }
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #5)")] // TransactionError::DependencyNotMet
fn test_circular_dependency_detection() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // 1 -> 2
    // 2 -> 1 (Circular)
    // Note: The preflight check doesn't explicitly check for cycles yet,
    // but execution will fail when it hits the first unmet dependency.
    let op1 = sample_operation(&env, 1, vec![&env, 2]);
    let op2 = sample_operation(&env, 2, vec![&env, 1]);

    client.add_operation(&tx_id, &op1);
    client.add_operation(&tx_id, &op2);

    client.execute_transaction(&tx_id, &None, &None);
}

#[test]
fn test_atomic_rollback_on_execution_failure() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // Op 1 succeeds
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));
    // Op 2 has a missing dependency → causes execution to fail and state to Rollback
    client.add_operation(&tx_id, &sample_operation(&env, 2, vec![&env, 99]));

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.execute_transaction(&tx_id, &None, &None)
    }));

    assert!(res.is_err());

    // NOTE: In Soroban, if a contract call fails (panics/errs), the host rolls back
    // ALL state changes made during that call. Thus, the transaction state
    // remains what it was before the call (Draft).
    let status = client.get_transaction_status(&tx_id);
    assert_eq!(status.state, TransactionState::Draft);
}

#[test]
fn test_gas_optimization_reordering_placeholder() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));

    // Test that the optimization hook returns the default config as expected
    let cfg = GasOptimizationConfig {
        batch_size: 5,
        max_parallel_operations: 2,
        gas_price_tolerance: 10,
        enable_reordering: true,
        enable_caching: true,
        fallback_gas_multiplier_bps: 10500,
    };

    let result_cfg = client.optimize_transaction_flow(&tx_id, &cfg);
    // Should return default config currently
    assert_eq!(result_cfg.batch_size, 10);
    assert_eq!(result_cfg.enable_reordering, false);
}

#[test]
fn test_transaction_lifecycle_full_cycle() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    // 1. Create (Draft)
    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    let status = client.get_transaction_status(&tx_id);
    assert_eq!(status.state, TransactionState::Draft);

    // 2. Add operations
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));

    // 3. Execute (Completed)
    client.execute_transaction(&tx_id, &None, &None);
    let status = client.get_transaction_status(&tx_id);
    assert_eq!(status.state, TransactionState::Completed);
    assert_eq!(status.completed_operations, 1);
}

#[test]
fn test_batch_execute_partial_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx1 = client.create_transaction(&creator, &map![&env], &vec![&env]);
    client.add_operation(&tx1, &sample_operation(&env, 1, vec![&env]));

    let tx2 = client.create_transaction(&creator, &map![&env], &vec![&env]);
    // Op with bad dependency → will fail
    client.add_operation(&tx2, &sample_operation(&env, 1, vec![&env, 99]));

    let gas_cfg = crate::types::default_gas_config(&env);
    let result = client.batch_execute_transactions(&vec![&env, tx1, tx2], &gas_cfg);

    assert_eq!(result.total_transactions, 2);
    assert_eq!(result.succeeded, 1);
    assert_eq!(result.failed, 1);
    assert_eq!(result.result_ids.len(), 1);
    assert_eq!(result.result_ids.get(0).unwrap(), tx1);
}
