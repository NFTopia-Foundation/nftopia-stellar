use soroban_sdk::{Address, Bytes, Env, Symbol, Vec};
use crate::error::SettlementError;
use crate::events::{
    emit_contract_paused, emit_contract_unpaused, emit_module_paused,
    emit_module_unpaused, emit_pause_scheduled, emit_pause_cancelled,
    ContractPausedEvent, ContractUnpausedEvent, ModulePausedEvent,
    ModuleUnpausedEvent, PauseScheduledEvent, PauseCancelledEvent,
};

const PAUSE_KEY: Symbol = Symbol::new("pause_info");
const PAUSE_SCHEDULE_KEY: Symbol = Symbol::new("pause_schedule");

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseInfo {
    pub paused: bool,
    pub paused_at: u64,
    pub paused_by: Address,
    pub reason: Option<Bytes>,
    pub modules_paused: Vec<Symbol>,
}

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
    pub fn get_pause_info(env: &Env) -> Option<PauseInfo> {
        env.storage().instance().get(&PAUSE_KEY)
    }

    pub fn get_scheduled_pause(env: &Env) -> Option<ScheduledPause> {
        env.storage().instance().get(&PAUSE_SCHEDULE_KEY)
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
            for paused_module in info.modules_paused.iter() {
                if paused_module == &Symbol::new(env, "all") || paused_module == &module_symbol {
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
            return Err(SettlementError::ModulePaused);
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

        env.storage().instance().set(&PAUSE_KEY, &pause_info);

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
        reason: Option<Bytes>,
    ) -> Result<(), SettlementError> {
        let current_time = env.ledger().timestamp();

        if !Self::is_paused(env) {
            return Err(SettlementError::NotPaused);
        }

        env.storage().instance().remove(&PAUSE_KEY);

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
            return Err(SettlementError::PauseAlreadyScheduled);
        }

        if delay_seconds < 3600 || delay_seconds > 604800 {
            return Err(SettlementError::InvalidAmount);
        }

        let scheduled = ScheduledPause {
            scheduled_at: current_time,
            execution_at: current_time + delay_seconds,
            modules: modules.clone(),
            reason: reason.clone(),
            scheduled_by: admin.clone(),
        };

        env.storage().instance().set(&PAUSE_SCHEDULE_KEY, &scheduled);

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

    pub fn cancel_scheduled_pause(
        env: &Env,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        let scheduled = Self::get_scheduled_pause(env)
            .ok_or(SettlementError::PauseNotScheduled)?;

        if scheduled.scheduled_by != *admin {
            return Err(SettlementError::PauseCancellationNotAllowed);
        }

        env.storage().instance().remove(&PAUSE_SCHEDULE_KEY);

        emit_pause_cancelled(
            env,
            PauseCancelledEvent {
                admin: admin.clone(),
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    pub fn execute_scheduled_pause(
        env: &Env,
        admin: &Address,
    ) -> Result<(), SettlementError> {
        let scheduled = Self::get_scheduled_pause(env)
            .ok_or(SettlementError::PauseNotScheduled)?;

        let current_time = env.ledger().timestamp();

        if current_time < scheduled.execution_at {
            return Err(SettlementError::PauseTimelockActive);
        }

        Self::pause(
            env,
            admin,
            Some(scheduled.reason.clone()),
            Some(scheduled.modules.clone()),
        )?;

        env.storage().instance().remove(&PAUSE_SCHEDULE_KEY);

        Ok(())
    }

    pub fn is_timelock_active(env: &Env) -> bool {
        if let Some(scheduled) = Self::get_scheduled_pause(env) {
            let current_time = env.ledger().timestamp();
            return current_time < scheduled.execution_at;
        }
        false
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