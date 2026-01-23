use soroban_sdk::{contracttype, Address, String as SorobanString, Vec, symbol_short};

/// Event emitted when a token is transferred
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferEvent {
    pub from: Address,
    pub to: Address,
    pub token_id: u64,
}

/// Event emitted when a token is approved
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalEvent {
    pub owner: Address,
    pub approved: Address,
    pub token_id: u64,
}

/// Event emitted when operator approval is set
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalForAllEvent {
    pub owner: Address,
    pub operator: Address,
    pub approved: bool,
}

/// Event emitted when a token is minted
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MintEvent {
    pub to: Address,
    pub token_id: u64,
    pub metadata_uri: SorobanString,
    pub creator: Address,
}

/// Event emitted when a token is burned
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BurnEvent {
    pub from: Address,
    pub token_id: u64,
}

/// Event emitted when metadata is updated
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataUpdateEvent {
    pub token_id: u64,
    pub metadata_uri: SorobanString,
}

/// Event emitted when base URI is updated
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BaseURIUpdateEvent {
    pub base_uri: SorobanString,
}

/// Event emitted when royalty info is updated
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltyUpdateEvent {
    pub token_id: Option<u64>, // None for default royalty
    pub recipient: Address,
    pub percentage: u32,
}

/// Event emitted when contract is paused/unpaused
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseEvent {
    pub is_paused: bool,
}

/// Event emitted when roles are updated
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleUpdateEvent {
    pub role: SorobanString, // "admin", "minter", "burner", "metadata_updater"
    pub address: Address,
    pub added: bool,
}

pub struct Events;

impl Events {
    pub fn emit_transfer(env: &soroban_sdk::Env, from: Address, to: Address, token_id: u64) {
        env.events().publish(
            (symbol_short!("transfer"),),
            TransferEvent {
                from,
                to,
                token_id,
            },
        );
    }

    pub fn emit_approval(env: &soroban_sdk::Env, owner: Address, approved: Address, token_id: u64) {
        env.events().publish(
            (symbol_short!("approval"),),
            ApprovalEvent {
                owner,
                approved,
                token_id,
            },
        );
    }

    pub fn emit_approval_for_all(
        env: &soroban_sdk::Env,
        owner: Address,
        operator: Address,
        approved: bool,
    ) {
        env.events().publish(
            (symbol_short!("appr_all"),), // Shortened to meet 9 char limit
            ApprovalForAllEvent {
                owner,
                operator,
                approved,
            },
        );
    }

    pub fn emit_mint(
        env: &soroban_sdk::Env,
        to: Address,
        token_id: u64,
        metadata_uri: SorobanString,
        creator: Address,
    ) {
        env.events().publish(
            (symbol_short!("mint"),),
            MintEvent {
                to,
                token_id,
                metadata_uri,
                creator,
            },
        );
    }

    pub fn emit_burn(env: &soroban_sdk::Env, from: Address, token_id: u64) {
        env.events().publish(
            (symbol_short!("burn"),),
            BurnEvent { from, token_id },
        );
    }

    pub fn emit_metadata_update(
        env: &soroban_sdk::Env,
        token_id: u64,
        metadata_uri: SorobanString,
    ) {
        env.events().publish(
            (symbol_short!("meta_upd"),), // Shortened to meet 9 char limit
            MetadataUpdateEvent {
                token_id,
                metadata_uri,
            },
        );
    }

    pub fn emit_base_uri_update(env: &soroban_sdk::Env, base_uri: SorobanString) {
        env.events().publish(
            (symbol_short!("base_uri"),), // Shortened to meet 9 char limit
            BaseURIUpdateEvent { base_uri },
        );
    }

    pub fn emit_royalty_update(
        env: &soroban_sdk::Env,
        token_id: Option<u64>,
        recipient: Address,
        percentage: u32,
    ) {
        env.events().publish(
            (symbol_short!("royalty"),), // Shortened to meet 9 char limit
            RoyaltyUpdateEvent {
                token_id,
                recipient,
                percentage,
            },
        );
    }

    pub fn emit_pause(env: &soroban_sdk::Env, is_paused: bool) {
        env.events().publish(
            (symbol_short!("pause"),),
            PauseEvent { is_paused },
        );
    }

    pub fn emit_role_update(
        env: &soroban_sdk::Env,
        role: SorobanString,
        address: Address,
        added: bool,
    ) {
        env.events().publish(
            (symbol_short!("role"),), // Shortened to meet 9 char limit
            RoleUpdateEvent {
                role,
                address,
                added,
            },
        );
    }
}
