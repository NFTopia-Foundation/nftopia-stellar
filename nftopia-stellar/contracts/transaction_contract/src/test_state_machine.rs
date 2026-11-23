//! Exhaustive coverage for `state_machine.rs`.
//!
//! `validate_transition` is checked against every (from, to) pair, so widening
//! or narrowing the allowed set, or adding a state, fails a test here instead
//! of slipping through.

use crate::error::TransactionError;
use crate::state_machine::{
    DEADLINE_SAFETY_MARGIN_LEDGERS, is_final, is_progressing, validate_transition,
    validate_transition_within_deadline,
};
use crate::types::TransactionState;
use TransactionState::{
    Cancelled, Completed, Draft, Executing, Failed, PartiallyComplete, Pending, RolledBack,
};

const ALL_STATES: [TransactionState; 8] = [
    Draft,
    Pending,
    Executing,
    PartiallyComplete,
    Completed,
    Failed,
    Cancelled,
    RolledBack,
];

/// The intended transition table. Must match the doc comment on
/// `validate_transition`.
const ALLOWED: [(TransactionState, TransactionState); 13] = [
    (Draft, Pending),
    (Draft, Executing),
    (Draft, Cancelled),
    (Pending, Executing),
    (Pending, Cancelled),
    (Executing, Completed),
    (Executing, Failed),
    (Executing, PartiallyComplete),
    (Failed, Pending),
    (Failed, RolledBack),
    (Failed, Cancelled),
    (PartiallyComplete, RolledBack),
    (PartiallyComplete, Cancelled),
];

/// Exhaustive match with no wildcard: adding a `TransactionState` variant
/// stops this compiling until the new state is added to `ALL_STATES` and the
/// matrix below.
fn index_of(state: &TransactionState) -> usize {
    match state {
        Draft => 0,
        Pending => 1,
        Executing => 2,
        PartiallyComplete => 3,
        Completed => 4,
        Failed => 5,
        Cancelled => 6,
        RolledBack => 7,
    }
}

fn is_allowed(from: &TransactionState, to: &TransactionState) -> bool {
    ALLOWED.iter().any(|(f, t)| f == from && t == to)
}

#[test]
fn test_all_states_lists_every_variant_once() {
    for (i, state) in ALL_STATES.iter().enumerate() {
        assert_eq!(index_of(state), i, "ALL_STATES out of order at {state:?}");
    }
}

#[test]
fn test_allowed_table_has_no_duplicates() {
    for (i, a) in ALLOWED.iter().enumerate() {
        for b in ALLOWED.iter().skip(i + 1) {
            assert_ne!(a, b, "duplicate entry in ALLOWED");
        }
    }
}

#[test]
fn test_validate_transition_matrix_covers_every_pair() {
    let mut checked = 0;
    let mut accepted = 0;

    for from in ALL_STATES.iter() {
        for to in ALL_STATES.iter() {
            let result = validate_transition(from, to);
            if is_allowed(from, to) {
                assert_eq!(result, Ok(()), "{from:?} -> {to:?} should be allowed");
                accepted += 1;
            } else {
                assert_eq!(
                    result,
                    Err(TransactionError::InvalidStateTransition),
                    "{from:?} -> {to:?} should be rejected"
                );
            }
            checked += 1;
        }
    }

    assert_eq!(checked, ALL_STATES.len() * ALL_STATES.len());
    assert_eq!(accepted, ALLOWED.len());
}

#[test]
fn test_no_state_may_transition_to_itself() {
    for state in ALL_STATES.iter() {
        assert_eq!(
            validate_transition(state, state),
            Err(TransactionError::InvalidStateTransition),
            "{state:?} -> {state:?} should be rejected"
        );
    }
}

#[test]
fn test_nothing_can_return_to_draft() {
    for from in ALL_STATES.iter() {
        assert_eq!(
            validate_transition(from, &Draft),
            Err(TransactionError::InvalidStateTransition),
            "{from:?} -> Draft should be rejected"
        );
    }
}

#[test]
fn test_final_states_are_terminal() {
    for from in ALL_STATES.iter().filter(|s| is_final(s)) {
        for to in ALL_STATES.iter() {
            assert_eq!(
                validate_transition(from, to),
                Err(TransactionError::InvalidStateTransition),
                "final state {from:?} must not move to {to:?}"
            );
        }
    }
}

#[test]
fn test_is_final_matches_states_without_outgoing_transitions() {
    // A state is final exactly when it has no allowed outgoing transition, so
    // is_final can't drift from validate_transition in either direction.
    for from in ALL_STATES.iter() {
        let has_exit = ALL_STATES
            .iter()
            .any(|to| validate_transition(from, to).is_ok());
        assert_eq!(
            is_final(from),
            !has_exit,
            "is_final({from:?}) disagrees with validate_transition"
        );
    }
}

#[test]
fn test_is_final_table() {
    let expected = [
        (Draft, false),
        (Pending, false),
        (Executing, false),
        (PartiallyComplete, false),
        (Completed, true),
        (Failed, false),
        (Cancelled, true),
        (RolledBack, true),
    ];
    for (state, final_) in expected.iter() {
        assert_eq!(is_final(state), *final_, "is_final({state:?})");
    }
}

#[test]
fn test_is_progressing_table() {
    let expected = [
        (Draft, false),
        (Pending, true),
        (Executing, true),
        (PartiallyComplete, true),
        (Completed, true),
        (Failed, false),
        (Cancelled, false),
        (RolledBack, false),
    ];
    for (state, progressing) in expected.iter() {
        assert_eq!(
            is_progressing(state),
            *progressing,
            "is_progressing({state:?})"
        );
    }
}

// ─── validate_transition_within_deadline ─────────────────────────────────────

const DEADLINE: u64 = 1_000;

fn ledger(n: u64) -> u32 {
    u32::try_from(n).expect("test ledger fits in u32")
}

/// Last ledger at which a progressing transition still lands inside the window.
fn last_allowed_ledger() -> u32 {
    ledger(DEADLINE - DEADLINE_SAFETY_MARGIN_LEDGERS)
}

#[test]
fn test_deadline_allows_progressing_transition_at_last_safe_ledger() {
    assert_eq!(
        validate_transition_within_deadline(
            &Pending,
            &Executing,
            Some(DEADLINE),
            last_allowed_ledger()
        ),
        Ok(())
    );
}

#[test]
fn test_deadline_rejects_progressing_transition_one_ledger_after_last_safe_ledger() {
    assert_eq!(
        validate_transition_within_deadline(
            &Pending,
            &Executing,
            Some(DEADLINE),
            last_allowed_ledger() + 1
        ),
        Err(TransactionError::OperationTimedOut)
    );
}

#[test]
fn test_deadline_rejects_progressing_transition_at_and_past_deadline_ledger() {
    for current in [DEADLINE, DEADLINE + 1] {
        assert_eq!(
            validate_transition_within_deadline(
                &Executing,
                &Completed,
                Some(DEADLINE),
                ledger(current)
            ),
            Err(TransactionError::OperationTimedOut),
            "progressing transition at ledger {current} should time out"
        );
    }
}

#[test]
fn test_deadline_never_blocks_terminal_transitions() {
    // Cancel / rollback / fail must stay possible after the deadline so a
    // stuck transaction can still be cleaned up.
    let terminal = [
        (Pending, Cancelled),
        (Failed, RolledBack),
        (PartiallyComplete, Cancelled),
        (Executing, Failed),
    ];
    for (from, to) in terminal.iter() {
        for current in [DEADLINE, DEADLINE + 1] {
            assert_eq!(
                validate_transition_within_deadline(from, to, Some(DEADLINE), ledger(current)),
                Ok(()),
                "{from:?} -> {to:?} at ledger {current} should not be blocked"
            );
        }
    }
}

#[test]
fn test_deadline_check_applies_to_every_progressing_transition() {
    for (from, to) in ALLOWED.iter() {
        let past = validate_transition_within_deadline(from, to, Some(DEADLINE), ledger(DEADLINE));
        let expected = if is_progressing(to) {
            Err(TransactionError::OperationTimedOut)
        } else {
            Ok(())
        };
        assert_eq!(past, expected, "{from:?} -> {to:?} at the deadline ledger");

        assert_eq!(
            validate_transition_within_deadline(from, to, Some(DEADLINE), last_allowed_ledger()),
            Ok(()),
            "{from:?} -> {to:?} inside the window"
        );
    }
}

#[test]
fn test_invalid_transition_is_reported_before_the_deadline() {
    // An illegal move stays InvalidStateTransition even when it's also late.
    assert_eq!(
        validate_transition_within_deadline(
            &Completed,
            &Executing,
            Some(DEADLINE),
            ledger(DEADLINE + 1)
        ),
        Err(TransactionError::InvalidStateTransition)
    );
}

#[test]
fn test_no_deadline_never_times_out() {
    for (from, to) in ALLOWED.iter() {
        assert_eq!(
            validate_transition_within_deadline(from, to, None, u32::MAX),
            Ok(()),
            "{from:?} -> {to:?} without a deadline"
        );
    }
}

#[test]
fn test_deadline_near_u32_max_does_not_overflow() {
    // current_ledger + margin is computed in u64 with saturating_add, so the
    // largest possible ledger must not wrap around into "in time".
    assert_eq!(
        validate_transition_within_deadline(
            &Pending,
            &Executing,
            Some(u64::from(u32::MAX)),
            u32::MAX
        ),
        Err(TransactionError::OperationTimedOut)
    );
}
