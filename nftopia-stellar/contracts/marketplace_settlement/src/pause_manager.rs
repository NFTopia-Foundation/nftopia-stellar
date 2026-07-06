use crate::error::{PauseError, SettlementError};
use crate::events::{
    emit_contract_paused, emit_contract_unpaused, emit_module_paused, emit_pause_cancelled,
    emit_pause_scheduled, ContractPausedEvent, ContractUnpausedEvent, ModulePausedEvent,
    PauseCancelledEvent, PauseScheduledEvent,
};
use soroban_sdk::{contracttype, Address, Bytes, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ModuleType {
    Sales,
    Auctions,
    Trades,
    Bundles,
    Disputes,
    Withdrawals,
    All,
}

impl ModuleType {
    pub fn to_symbol(&self, env: &Env) -> Symbol {
        match self {
            ModuleType::Sales => Symbol::new(env, "sales"),
            ModuleType::Auctions => Symbol::new(env, "auctions"),
            ModuleType::Trades => Symbol::new(env, "trades"),
            ModuleType::Bundles => Symbol::new(env, "bundles"),
            ModuleType::Disputes => Symbol::new(env, "disputes"),
            ModuleType::Withdrawals => Symbol::new(env, "withdrawals"),
            ModuleType::All => Symbol::new(env, "all"),
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseInfo {
    pub paused: bool,
    pub paused_at: u64,
    pub paused_by: Address,
    pub reason: Option<Bytes>,
    pub modules_paused: Vec<Symbol>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScheduledPause {
    pub scheduled_at: u64,
    pub execution_at: u64,
    pub modules: Vec<Symbol>,
    pub reason: Bytes,
    pub scheduled_by: Address,
}

pub struct PauseManager;

impl PauseManager {
    fn pause_key(env: &Env) -> Symbol {
        Symbol::new(env, "pause_info")
    }

    fn schedule_key(env: &Env) -> Symbol {
        Symbol::new(env, "pause_schedule")
    }

    pub fn get_pause_info(env: &Env) -> Option<PauseInfo> {
        env.storage().instance().get(&Self::pause_key(env))
    }

    pub fn get_scheduled_pause(env: &Env) -> Option<ScheduledPause> {
        env.storage().instance().get(&Self::schedule_key(env))
    }

    pub fn is_paused(env: &Env) -> bool {
        Self::get_pause_info(env)
            .map(|info| info.paused)
            .unwrap_or(false)
    }

    pub fn is_module_paused(env: &Env, module: ModuleType) -> bool {
        let module_symbol = module.to_symbol(env);
        if let Some(info) = Self::get_pause_info(env) {
            if !info.paused {
                return false;
            }
            let all_symbol = Symbol::new(env, "all");
            for paused_module in info.modules_paused.iter() {
                // FIXED: Removed ampersands because Soroban's Vec::iter() yields items by value
                if paused_module == all_symbol || paused_module == module_symbol {
                    return true;
                }
            }
        }
        false
    }

    pub fn check_not_paused(env: &Env) -> Result<(), SettlementError> {
        if Self::is_paused(env) {
            return Err(SettlementError::ContractPaused);
        }
        Ok(())
    }

    pub fn check_module_not_paused(env: &Env, module: ModuleType) -> Result<(), SettlementError> {
        if Self::is_module_paused(env, module) {
            return Err(PauseError::ModulePaused.into());
        }
        Ok(())
    }

    pub fn pause(
        env: &Env,
        admin: &Address,
        reason: Option<Bytes>,
        modules: Option<Vec<Symbol>>,
    ) -> Result<(), SettlementError> {
        let current_time = env.ledger().timestamp();
        let modules_to_pause = modules.unwrap_or_else(|| {
            let mut vec = Vec::new(env);
            vec.push_back(Symbol::new(env, "all"));
            vec
        });

        let pause_info = PauseInfo {
            paused: true,
            paused_at: current_time,
            paused_by: admin.clone(),
            reason,
            modules_paused: modules_to_pause.clone(),
        };

        env.storage()
            .instance()
            .set(&Self::pause_key(env), &pause_info);

        emit_contract_paused(
            env,
            ContractPausedEvent {
                paused: true,
                admin: admin.clone(),
                timestamp: current_time,
            },
        );

        for module in modules_to_pause.iter() {
            emit_module_paused(
                env,
                ModulePausedEvent {
                    module: module.clone(),
                    admin: admin.clone(),
                    timestamp: current_time,
                },
            );
        }

        Ok(())
    }

    pub fn unpause(
        env: &Env,
        admin: &Address,
        _reason: Option<Bytes>,
    ) -> Result<(), SettlementError> {
        let current_time = env.ledger().timestamp();

        if !Self::is_paused(env) {
            return Err(PauseError::NotPaused.into());
        }

        env.storage().instance().remove(&Self::pause_key(env));

        emit_contract_unpaused(
            env,
            ContractUnpausedEvent {
                admin: admin.clone(),
                timestamp: current_time,
            },
        );

        Ok(())
    }

    pub fn schedule_pause(
        env: &Env,
        admin: &Address,
        delay_seconds: u64,
        modules: Vec<Symbol>,
        reason: Bytes,
    ) -> Result<(), SettlementError> {
        let current_time = env.ledger().timestamp();

        if Self::get_scheduled_pause(env).is_some() {
            return Err(PauseError::PauseAlreadyScheduled.into());
        }

        // FIXED: Replaced manual boundary checks with an inclusive range pattern
        if !(3600..=604800).contains(&delay_seconds) {
            return Err(SettlementError::InvalidAmount);
        }

        let scheduled = ScheduledPause {
            scheduled_at: current_time,
            execution_at: current_time + delay_seconds,
            modules: modules.clone(),
            reason: reason.clone(),
            scheduled_by: admin.clone(),
        };

        env.storage()
            .instance()
            .set(&Self::schedule_key(env), &scheduled);

        emit_pause_scheduled(
            env,
            PauseScheduledEvent {
                admin: admin.clone(),
                execution_at: current_time + delay_seconds,
                modules,
                reason,
                timestamp: current_time,
            },
        );

        Ok(())
    }

    pub fn cancel_scheduled_pause(env: &Env, admin: &Address) -> Result<(), SettlementError> {
        let scheduled = Self::get_scheduled_pause(env).ok_or(PauseError::PauseNotScheduled)?;

        if scheduled.scheduled_by != *admin {
            return Err(PauseError::PauseCancellationNotAllowed.into());
        }

        env.storage().instance().remove(&Self::schedule_key(env));

        emit_pause_cancelled(
            env,
            PauseCancelledEvent {
                admin: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    pub fn execute_scheduled_pause(env: &Env, admin: &Address) -> Result<(), SettlementError> {
        let scheduled = Self::get_scheduled_pause(env).ok_or(PauseError::PauseNotScheduled)?;

        let current_time = env.ledger().timestamp();

        if current_time < scheduled.execution_at {
            return Err(PauseError::PauseTimelockActive.into());
        }

        Self::pause(
            env,
            admin,
            Some(scheduled.reason.clone()),
            Some(scheduled.modules.clone()),
        )?;

        env.storage().instance().remove(&Self::schedule_key(env));

        Ok(())
    }

    pub fn is_timelock_active(env: &Env) -> bool {
        if let Some(scheduled) = Self::get_scheduled_pause(env) {
            let current_time = env.ledger().timestamp();
            current_time < scheduled.execution_at
        } else {
            false
        }
    }

    pub fn get_timelock_remaining(env: &Env) -> Option<u64> {
        if let Some(scheduled) = Self::get_scheduled_pause(env) {
            let current_time = env.ledger().timestamp();
            if current_time < scheduled.execution_at {
                return Some(scheduled.execution_at - current_time);
            }
        }
        None
    }

    pub fn get_paused_modules(env: &Env) -> Vec<Symbol> {
        if let Some(info) = Self::get_pause_info(env) {
            return info.modules_paused;
        }
        Vec::new(env)
    }
}
