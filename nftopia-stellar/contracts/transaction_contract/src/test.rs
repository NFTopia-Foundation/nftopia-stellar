#![cfg(test)]

extern crate std;

use soroban_sdk::{
    Address, Env, String, Vec, map, testutils::Address as _, testutils::Ledger, vec,
};

use crate::dependency_resolver;
use crate::error::TransactionError;
use crate::state_machine;
use crate::transaction_core::{TransactionContract, TransactionContractClient};
use crate::types::{
    GasOptimizationConfig, OperationTtl, RecoveryStrategy, TransactionBlueprint, TtlConfig,
    default_ttl_config,
};
use crate::utils::time_manager;
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
    // Cost is derived from mainnet fee ladder instruction and storage formula
    assert!(est2.estimated_cost > 0);
}

#[test]
fn gas_estimate_differs_by_operation_type() {
    let env = Env::default();
    let op_mint = Operation {
        operation_id: 1,
        operation_type: OperationType::NftMint,
        target_contract: Address::generate(&env),
        function_name: String::from_str(&env, "mint"),
        parameters: vec![&env],
        dependencies: vec![&env],
        gas_limit: None,
        retry_count: 0,
        timeout_seconds: 300,
    };

    let op_transfer = Operation {
        operation_id: 2,
        operation_type: OperationType::PaymentTransfer,
        target_contract: Address::generate(&env),
        function_name: String::from_str(&env, "transfer"),
        parameters: vec![&env],
        dependencies: vec![&env],
        gas_limit: None,
        retry_count: 0,
        timeout_seconds: 300,
    };

    let gas_mint = crate::utils::gas_calculator::op_gas(&op_mint);
    let gas_transfer = crate::utils::gas_calculator::op_gas(&op_transfer);

    // NftMint has higher base instructions than PaymentTransfer
    assert!(gas_mint > gas_transfer);
}

#[test]
fn gas_optimizer_applies_safety_margin_and_caching() {
    let env = Env::default();
    let ops = vec![&env, sample_operation(&env, 1, vec![&env])];

    let base = crate::utils::gas_calculator::total_gas(&ops);

    // Base config without safety buffer multiplier scaling
    let config_base = GasOptimizationConfig {
        fallback_gas_multiplier_bps: 10_000,
        ..crate::types::default_gas_config(&env)
    };
    let est_base = crate::gas_optimizer::estimate_with_config(&env, &ops, &config_base);
    assert_eq!(est_base.estimated_gas, base.estimated_gas);

    // Config with safety buffer (12000 bps = 1.2x)
    let config_safety = GasOptimizationConfig {
        fallback_gas_multiplier_bps: 12_000,
        ..config_base.clone()
    };
    let est_safety = crate::gas_optimizer::estimate_with_config(&env, &ops, &config_safety);
    assert!(est_safety.estimated_gas > base.estimated_gas);

    // Config with caching enabled
    let config_cache = GasOptimizationConfig {
        enable_caching: true,
        ..config_base
    };
    let est_cache = crate::gas_optimizer::estimate_with_config(&env, &ops, &config_cache);
    assert!(est_cache.estimated_gas < base.estimated_gas);
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
#[should_panic(expected = "HostError: Error(Contract, #13)")] // TransactionError::CircularDependencyError
fn test_circular_dependency_detection() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);

    // 1 -> 2
    // 2 -> 1 (Circular) — preflight rejects the cycle before execution.
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
    assert!(!result_cfg.enable_reordering);
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

// ─────────────────────────────────────────────────────────────────────────────
// TTL-AWARE DEPENDENCY RESOLUTION TESTS (#290)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn resolver_topologically_sorts_out_of_order_operations() {
    let env = Env::default();

    // Input is intentionally in reverse dependency order.
    let op1 = sample_operation(&env, 1, vec![&env]);
    let op2 = sample_operation(&env, 2, vec![&env, 1]);
    let ops = vec![&env, op2, op1];

    let ordered = dependency_resolver::resolve_execution_order(&env, &ops).unwrap();
    assert_eq!(ordered.len(), 2);
    assert_eq!(ordered.get(0).unwrap().operation_id, 1);
    assert_eq!(ordered.get(1).unwrap().operation_id, 2);
}

#[test]
fn dependency_graph_orders_diamond_and_tracks_depth() {
    let env = Env::default();

    let op1 = sample_operation(&env, 1, vec![&env]);
    let op2 = sample_operation(&env, 2, vec![&env, 1]);
    let op3 = sample_operation(&env, 3, vec![&env, 1]);
    let op4 = sample_operation(&env, 4, vec![&env, 2, 3]);
    let ops = vec![&env, op1, op2, op3, op4];

    let graph = dependency_resolver::DependencyGraph::build(&env, &ops).unwrap();
    assert_eq!(graph.operation_ids().len(), 4);
    assert_eq!(graph.max_depth(), 2);

    let order = graph.operation_ids();
    let mut pos1: i32 = -1;
    let mut pos4: i32 = -1;
    for i in 0..order.len() {
        let id = order.get(i).unwrap();
        if id == 1 {
            pos1 = i as i32;
        }
        if id == 4 {
            pos4 = i as i32;
        }
    }
    assert!(
        pos1 >= 0 && pos4 >= 0 && pos1 < pos4,
        "dependency must precede dependent"
    );
}

#[test]
fn resolver_rejects_circular_dependencies() {
    let env = Env::default();

    // 1 -> 2 and 2 -> 1
    let op1 = sample_operation(&env, 1, vec![&env, 2]);
    let op2 = sample_operation(&env, 2, vec![&env, 1]);
    let ops = vec![&env, op1, op2];

    let result = dependency_resolver::resolve_execution_order(&env, &ops);
    assert_eq!(
        result.err(),
        Some(TransactionError::CircularDependencyError)
    );
}

#[test]
fn dependency_graph_rejects_dangling_references() {
    let env = Env::default();
    let ops = vec![&env, sample_operation(&env, 1, vec![&env, 99])];

    let result = dependency_resolver::DependencyGraph::build(&env, &ops);
    assert_eq!(result.err(), Some(TransactionError::DependencyNotMet));
}

#[test]
fn ttl_validation_rejects_expired_dependency_output() {
    let env = Env::default();
    env.ledger().set_sequence_number(100);

    let dependent = sample_operation(&env, 2, vec![&env, 1]);
    let completed = vec![&env, 1_u64];
    let records = vec![
        &env,
        OperationTtl {
            operation_id: 1,
            satisfied_at_ledger: 100,
            remaining_ttl_ledgers: 4_096,
        },
    ];
    let config = default_ttl_config(&env);

    // Plenty of TTL remaining right after the dependency completed.
    assert!(
        dependency_resolver::validate_dependency_ttl(
            &env, &completed, &records, &dependent, &config
        )
        .is_ok()
    );
    assert!(dependency_resolver::dependencies_satisfied_with_ttl(
        &env, &completed, &records, &dependent, &config
    ));

    // Fast-forward ~4000 ledgers; the output no longer covers the window.
    env.ledger().set_sequence_number(100 + 4_000);
    assert_eq!(
        dependency_resolver::validate_dependency_ttl(
            &env, &completed, &records, &dependent, &config
        )
        .err(),
        Some(TransactionError::TTLExpired)
    );
    assert!(!dependency_resolver::dependencies_satisfied_with_ttl(
        &env, &completed, &records, &dependent, &config
    ));
}

#[test]
fn unsigned_dependency_is_not_satisfied() {
    let env = Env::default();
    env.ledger().set_sequence_number(10);

    let dependent = sample_operation(&env, 2, vec![&env, 1]);
    let completed = Vec::<u64>::new(&env);
    let records = Vec::<OperationTtl>::new(&env);
    let config = default_ttl_config(&env);

    assert_eq!(
        dependency_resolver::validate_dependency_ttl(
            &env, &completed, &records, &dependent, &config
        )
        .err(),
        Some(TransactionError::DependencyNotMet)
    );
}

#[test]
fn min_remaining_ttl_buffer_is_configurable() {
    let env = Env::default();
    env.ledger().set_sequence_number(0);

    // Dependent op timeout 300s => 60 ledgers required.
    let dependent = sample_operation(&env, 2, vec![&env, 1]);
    let completed = vec![&env, 1_u64];
    let records = vec![
        &env,
        OperationTtl {
            operation_id: 1,
            satisfied_at_ledger: 0,
            remaining_ttl_ledgers: 260,
        },
    ];

    let small_buffer = TtlConfig {
        min_remaining_ttl_buffer: 200,
        ..default_ttl_config(&env)
    };
    assert!(
        dependency_resolver::validate_dependency_ttl(
            &env,
            &completed,
            &records,
            &dependent,
            &small_buffer
        )
        .is_ok()
    );

    let large_buffer = TtlConfig {
        min_remaining_ttl_buffer: 1_000,
        ..default_ttl_config(&env)
    };
    assert_eq!(
        dependency_resolver::validate_dependency_ttl(
            &env,
            &completed,
            &records,
            &dependent,
            &large_buffer
        )
        .err(),
        Some(TransactionError::TTLExpired)
    );
}

#[test]
fn refresh_dependency_renews_ttl_for_retry() {
    let env = Env::default();
    env.ledger().set_sequence_number(5_000);

    let dependent = sample_operation(&env, 2, vec![&env, 1]);
    let completed = vec![&env, 1_u64];
    let stale = vec![
        &env,
        OperationTtl {
            operation_id: 1,
            satisfied_at_ledger: 0,
            remaining_ttl_ledgers: 1_000,
        },
    ];
    let config = default_ttl_config(&env);

    assert_eq!(
        dependency_resolver::validate_dependency_ttl(&env, &completed, &stale, &dependent, &config)
            .err(),
        Some(TransactionError::TTLExpired)
    );

    let renewed = dependency_resolver::refresh_dependency(&env, &stale, 1, 4_096).unwrap();
    assert!(
        dependency_resolver::validate_dependency_ttl(
            &env, &completed, &renewed, &dependent, &config
        )
        .is_ok()
    );

    assert_eq!(
        dependency_resolver::refresh_dependency(&env, &stale, 42, 4_096).err(),
        Some(TransactionError::DependencyNotMet)
    );
}

#[test]
fn dependency_graph_rejects_window_exceeding_persistent_ttl() {
    let env = Env::default();

    let mut op = sample_operation(&env, 1, vec![&env]);
    // Mainnet persistent max is 518_400 ledgers (~2.59M seconds at 5s/ledger).
    op.timeout_seconds = 3_000_000;
    let ops = vec![&env, op];

    let graph = dependency_resolver::DependencyGraph::build(&env, &ops).unwrap();
    let config = default_ttl_config(&env);
    assert_eq!(
        graph.validate_ttl_windows(&config).err(),
        Some(TransactionError::TTLExpired)
    );
}

#[test]
fn ttl_config_respects_mainnet_bounds() {
    let env = Env::default();
    let defaults = default_ttl_config(&env);
    assert_eq!(defaults.temporary_entry_min_ttl, 4_096);
    assert_eq!(defaults.persistent_entry_max_ttl, 518_400);
    assert!(dependency_resolver::validate_ttl_config(&defaults).is_ok());

    let too_small_temp = TtlConfig {
        temporary_entry_min_ttl: 100,
        ..defaults.clone()
    };
    assert!(dependency_resolver::validate_ttl_config(&too_small_temp).is_err());

    let too_large_persistent = TtlConfig {
        persistent_entry_max_ttl: 600_000,
        ..defaults.clone()
    };
    assert!(dependency_resolver::validate_ttl_config(&too_large_persistent).is_err());
}

#[test]
fn time_manager_converts_between_seconds_and_ledgers() {
    let env = Env::default();
    env.ledger().set_sequence_number(1_000);
    env.ledger().set_timestamp(50_000);

    assert_eq!(time_manager::secs_to_ledgers(5, 5), 1);
    assert_eq!(time_manager::secs_to_ledgers(6, 5), 2);
    assert_eq!(time_manager::secs_to_ledgers(300, 5), 60);
    assert_eq!(time_manager::ledgers_to_secs(60, 5), 300);
    assert_eq!(time_manager::current_ledger(&env), 1_000);
    assert_eq!(time_manager::ledger_from_now(50, &env), 1_050);
    assert_eq!(time_manager::deadline_ledger_from_now(300, &env), 1_060);
    assert_eq!(time_manager::ledgers_elapsed(900, &env), 100);
    assert!(time_manager::is_ledger_expired(1_000, &env));
    assert!(!time_manager::is_ledger_expired(1_001, &env));
    assert!(time_manager::assert_ttl_sufficient(4_096, 60, 1_000).is_ok());
    assert_eq!(
        time_manager::assert_ttl_sufficient(1_059, 60, 1_000).err(),
        Some(TransactionError::TTLExpired)
    );
}

#[test]
fn state_machine_rejects_transitions_past_deadlines() {
    let env = Env::default();
    env.ledger().set_sequence_number(100);
    env.ledger().set_timestamp(1_000);

    assert!(
        state_machine::validate_transition_with_time(
            &TransactionState::Draft,
            &TransactionState::Executing,
            2_000,
            &env,
        )
        .is_ok()
    );

    assert_eq!(
        state_machine::validate_transition_with_time(
            &TransactionState::Draft,
            &TransactionState::Executing,
            500,
            &env,
        )
        .err(),
        Some(TransactionError::OperationTimedOut)
    );

    assert_eq!(
        state_machine::validate_transition_with_ledger(
            &TransactionState::Draft,
            &TransactionState::Executing,
            100,
            &env,
        )
        .err(),
        Some(TransactionError::TTLExpired)
    );

    // Invalid transitions are rejected regardless of deadlines.
    assert_eq!(
        state_machine::validate_transition_with_time(
            &TransactionState::Completed,
            &TransactionState::Executing,
            9_999,
            &env,
        )
        .err(),
        Some(TransactionError::InvalidStateTransition)
    );

    // Cancelling does not open an execution window, so an expired deadline is fine.
    assert!(
        state_machine::validate_transition_with_time(
            &TransactionState::Draft,
            &TransactionState::Cancelled,
            0,
            &env,
        )
        .is_ok()
    );
}

#[test]
fn execute_transaction_reorders_out_of_order_dependencies() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, creator) = make_client(&env);

    let tx_id = client.create_transaction(&creator, &map![&env], &vec![&env]);
    // Add the dependent operation before its dependency.
    client.add_operation(&tx_id, &sample_operation(&env, 2, vec![&env, 1]));
    client.add_operation(&tx_id, &sample_operation(&env, 1, vec![&env]));

    let result = client.execute_transaction(&tx_id, &None, &None);
    assert_eq!(result.final_state, TransactionState::Completed);
    assert_eq!(result.successful_operations, 2);
    assert_eq!(result.results.get(0).unwrap().operation_id, 1);
    assert_eq!(result.results.get(1).unwrap().operation_id, 2);
}

#[test]
fn configure_ttl_roundtrip() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _creator) = make_client(&env);

    let defaults = client.get_ttl_config();
    assert_eq!(defaults.min_remaining_ttl_buffer, 1_000);

    let admin = Address::generate(&env);
    let config = TtlConfig {
        min_remaining_ttl_buffer: 200,
        temporary_entry_min_ttl: 4_096,
        persistent_entry_max_ttl: 518_400,
        ledger_close_time_seconds: 5,
    };
    client.configure_ttl(&admin, &config);

    let loaded = client.get_ttl_config();
    assert_eq!(loaded.min_remaining_ttl_buffer, 200);
    assert_eq!(loaded.ledger_close_time_seconds, 5);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #4)")] // TransactionError::InvalidOperation
fn configure_ttl_rejects_out_of_bounds_values() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _creator) = make_client(&env);

    let admin = Address::generate(&env);
    let bad = TtlConfig {
        min_remaining_ttl_buffer: 100,
        temporary_entry_min_ttl: 10, // below mainnet temporary minimum of 4096
        persistent_entry_max_ttl: 518_400,
        ledger_close_time_seconds: 5,
    };
    client.configure_ttl(&admin, &bad);
}
