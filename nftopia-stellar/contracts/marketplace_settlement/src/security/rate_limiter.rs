use crate::error::SettlementError;
use soroban_sdk::{contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateLimitConfig {
    pub limit: u32,
    pub window_seconds: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateLimitState {
    pub window_start: u64,
    pub count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RateLimitStorageKey {
    State(Address, Symbol),
    Config(Symbol),
}

pub struct RateLimiter;

impl RateLimiter {
    pub fn get_config(env: &Env, function: &Symbol) -> Option<RateLimitConfig> {
        let key = RateLimitStorageKey::Config(function.clone());

        if env.storage().instance().has(&key) {
            env.storage().instance().get(&key)
        } else {
            // Return defaults if not configured
            let place_bid_sym = Symbol::new(env, "place_bid");
            let reveal_bid_sym = Symbol::new(env, "reveal_bid");
            let create_auction_sym = Symbol::new(env, "create_auction");
            let create_sale_sym = Symbol::new(env, "create_sale");
            let create_trade_sym = Symbol::new(env, "create_trade");
            let accept_trade_sym = Symbol::new(env, "accept_trade");
            let execute_trade_sym = Symbol::new(env, "execute_trade");

            if function == &place_bid_sym || function == &reveal_bid_sym {
                Some(RateLimitConfig {
                    limit: 5,
                    window_seconds: 60,
                })
            } else if function == &create_auction_sym
                || function == &create_sale_sym
                || function == &create_trade_sym
                || function == &accept_trade_sym
                || function == &execute_trade_sym
            {
                Some(RateLimitConfig {
                    limit: 10,
                    window_seconds: 60,
                })
            } else {
                None
            }
        }
    }

    pub fn set_config(env: &Env, function: &Symbol, limit: u32, window_seconds: u64) {
        let key = RateLimitStorageKey::Config(function.clone());
        let config = RateLimitConfig {
            limit,
            window_seconds,
        };
        env.storage().instance().set(&key, &config);
    }

    pub fn check_rate_limit(
        env: &Env,
        caller: &Address,
        function: &Symbol,
    ) -> Result<(), SettlementError> {
        let config = match Self::get_config(env, function) {
            Some(cfg) => cfg,
            None => return Ok(()),
        };

        let key = RateLimitStorageKey::State(caller.clone(), function.clone());
        let current_time = env.ledger().timestamp();

        let has_key = env.storage().persistent().has(&key);

        let mut state = if has_key {
            env.storage()
                .persistent()
                .get::<_, RateLimitState>(&key)
                .unwrap()
        } else {
            RateLimitState {
                window_start: current_time,
                count: 0,
            }
        };

        if current_time >= state.window_start + config.window_seconds {
            // Reset window
            state.window_start = current_time;
            state.count = 1;
            env.storage().persistent().set(&key, &state);
            env.storage().persistent().extend_ttl(&key, 1000, 5000);
            Ok(())
        } else {
            // Within same window
            if state.count >= config.limit {
                let event = crate::events::RateLimitExceededEvent {
                    caller: caller.clone(),
                    function: function.clone(),
                    window_seconds: config.window_seconds,
                    limit: config.limit,
                    timestamp: current_time,
                };
                crate::events::emit_rate_limit_exceeded(env, event);
                Err(SettlementError::CooldownActive)
            } else {
                state.count += 1;
                env.storage().persistent().set(&key, &state);
                env.storage().persistent().extend_ttl(&key, 1000, 5000);
                Ok(())
            }
        }
    }
}
