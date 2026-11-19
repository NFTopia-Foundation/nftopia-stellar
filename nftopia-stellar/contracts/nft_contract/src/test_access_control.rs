//! Negative-path coverage for the role checks in `access_control.rs`.
//!
//! Every test asserts the specific `ContractError` variant rather than a bare
//! failure, and checks that a rejected call left state untouched.

use crate::access_control;
use crate::error::ContractError;
use crate::types::{CollectionConfig, TokenAttribute, role};
use crate::{NftContract, NftContractClient};
use soroban_sdk::{Address, Env, String, Vec, testutils::Address as _};

fn setup(env: &Env) -> (NftContractClient<'_>, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register(NftContract, ());
    let client = NftContractClient::new(env, &contract_id);
    let config = CollectionConfig {
        name: String::from_str(env, "NFTopia"),
        symbol: String::from_str(env, "NFTP"),
        base_uri: String::from_str(env, ""),
        max_supply: 1000,
        mint_price: None,
        is_revealed: true,
        metadata_is_frozen: false,
    };
    client.initialize(&admin, &config, &None);
    (client, admin)
}

fn mint_to(env: &Env, client: &NftContractClient<'_>, minter: &Address, to: &Address) -> u64 {
    client.mint(
        minter,
        to,
        &String::from_str(env, "ipfs://hash"),
        &Vec::new(env),
        &None,
    )
}

/// Error raised through `panic_with_error!` from an entrypoint that returns `()`.
fn host_error(err: ContractError) -> soroban_sdk::Error {
    soroban_sdk::Error::from_contract_error(err as u32)
}

// ─── require_minter ──────────────────────────────────────────────────────────

#[test]
fn test_mint_without_minter_role_fails_with_not_minter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let stranger = Address::generate(&env);
    let result = client.try_mint(
        &stranger,
        &stranger,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    assert_eq!(result, Err(Ok(ContractError::NotMinter)));
    assert_eq!(client.total_supply(), 0);
    assert_eq!(client.balance_of(&stranger), 0);
}

#[test]
fn test_batch_mint_without_minter_role_fails_with_not_minter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let stranger = Address::generate(&env);
    let mut recipients: Vec<Address> = Vec::new(&env);
    let mut uris: Vec<String> = Vec::new(&env);
    let mut attrs: Vec<Vec<TokenAttribute>> = Vec::new(&env);
    for _ in 0..2u32 {
        recipients.push_back(stranger.clone());
        uris.push_back(String::from_str(&env, "ipfs://hash"));
        attrs.push_back(Vec::new(&env));
    }

    let result = client.try_batch_mint(&stranger, &recipients, &uris, &attrs);

    assert_eq!(result, Err(Ok(ContractError::NotMinter)));
    assert_eq!(client.total_supply(), 0);
}

#[test]
fn test_mint_with_other_roles_but_not_minter_fails() {
    // BURNER and METADATA_UPDATER must not imply minting rights.
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let holder = Address::generate(&env);
    client.grant_role(&admin, &holder, &role::BURNER);
    client.grant_role(&admin, &holder, &role::METADATA_UPDATER);

    let result = client.try_mint(
        &holder,
        &holder,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );

    assert_eq!(result, Err(Ok(ContractError::NotMinter)));
    assert_eq!(client.total_supply(), 0);
}

#[test]
fn test_granted_minter_can_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let minter = Address::generate(&env);
    let user = Address::generate(&env);
    client.grant_role(&admin, &minter, &role::MINTER);

    let token_id = mint_to(&env, &client, &minter, &user);
    assert_eq!(client.owner_of(&token_id), user);
    assert_eq!(client.total_supply(), 1);
}

#[test]
fn test_revoked_minter_can_no_longer_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let minter = Address::generate(&env);
    let user = Address::generate(&env);
    client.grant_role(&admin, &minter, &role::MINTER);
    mint_to(&env, &client, &minter, &user);

    client.revoke_role(&admin, &minter, &role::MINTER);
    assert!(!client.has_role(&minter, &role::MINTER));

    let result = client.try_mint(
        &minter,
        &user,
        &String::from_str(&env, "ipfs://hash"),
        &Vec::new(&env),
        &None,
    );
    assert_eq!(result, Err(Ok(ContractError::NotMinter)));
    assert_eq!(client.total_supply(), 1);
}

// ─── burn authorization ──────────────────────────────────────────────────────

#[test]
fn test_burn_by_stranger_fails_with_not_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let stranger = Address::generate(&env);
    let token_id = mint_to(&env, &client, &admin, &owner);

    assert_eq!(
        client.try_burn(&stranger, &token_id),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert_eq!(client.owner_of(&token_id), owner);
    assert_eq!(client.total_supply(), 1);
}

#[test]
fn test_revoked_burner_can_no_longer_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let burner = Address::generate(&env);
    let token_id = mint_to(&env, &client, &admin, &owner);

    client.grant_role(&admin, &burner, &role::BURNER);
    client.revoke_role(&admin, &burner, &role::BURNER);

    assert_eq!(
        client.try_burn(&burner, &token_id),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert_eq!(client.owner_of(&token_id), owner);
}

#[test]
fn test_batch_burn_by_stranger_fails_with_not_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let stranger = Address::generate(&env);
    let first = mint_to(&env, &client, &admin, &owner);
    let second = mint_to(&env, &client, &admin, &owner);

    let mut ids: Vec<u64> = Vec::new(&env);
    ids.push_back(first);
    ids.push_back(second);

    assert_eq!(
        client.try_batch_burn(&stranger, &ids),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert_eq!(client.total_supply(), 2);
    assert_eq!(client.balance_of(&owner), 2);
}

// ─── metadata update entrypoints ─────────────────────────────────────────────

#[test]
fn test_set_token_uri_by_stranger_fails_with_not_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let stranger = Address::generate(&env);
    let token_id = mint_to(&env, &client, &admin, &owner);

    let result =
        client.try_set_token_uri(&stranger, &token_id, &String::from_str(&env, "ipfs://evil"));
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
    assert_eq!(
        client.token_uri(&token_id),
        String::from_str(&env, "ipfs://hash")
    );
}

#[test]
fn test_set_base_uri_by_stranger_fails_with_not_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let owner = Address::generate(&env);
    let stranger = Address::generate(&env);
    let token_id = mint_to(&env, &client, &admin, &owner);

    let result = client.try_set_base_uri(&stranger, &String::from_str(&env, "ipfs://evil/"));
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
    // An empty base URI means token_uri still falls back to the per-token URI.
    assert_eq!(
        client.token_uri(&token_id),
        String::from_str(&env, "ipfs://hash")
    );
}

#[test]
fn test_set_base_uri_by_metadata_updater_alone_fails() {
    // set_base_uri is gated on OWNER/ADMIN; METADATA_UPDATER alone is not enough.
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let updater = Address::generate(&env);
    client.grant_role(&admin, &updater, &role::METADATA_UPDATER);

    let result = client.try_set_base_uri(&updater, &String::from_str(&env, "ipfs://new/"));
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
}

#[test]
fn test_freeze_metadata_by_stranger_fails_with_not_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let stranger = Address::generate(&env);
    assert_eq!(
        client.try_freeze_metadata(&stranger),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert!(!client.is_metadata_frozen());
}

#[test]
fn test_freeze_metadata_by_admin_without_owner_role_fails() {
    // freeze_metadata is owner-only; ADMIN must not be enough.
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let delegate = Address::generate(&env);
    client.grant_role(&admin, &delegate, &role::ADMIN);

    assert_eq!(
        client.try_freeze_metadata(&delegate),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert!(!client.is_metadata_frozen());
}

// ─── role lifecycle ──────────────────────────────────────────────────────────

#[test]
fn test_stranger_cannot_grant_themselves_a_role() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let stranger = Address::generate(&env);
    for r in [
        role::OWNER,
        role::ADMIN,
        role::MINTER,
        role::BURNER,
        role::METADATA_UPDATER,
    ] {
        assert_eq!(
            client.try_grant_role(&stranger, &stranger, &r),
            Err(Ok(host_error(ContractError::NotAuthorized)))
        );
        assert!(!client.has_role(&stranger, &r));
    }
}

#[test]
fn test_admin_without_owner_role_cannot_grant_roles() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let delegate = Address::generate(&env);
    let target = Address::generate(&env);
    client.grant_role(&admin, &delegate, &role::ADMIN);

    assert_eq!(
        client.try_grant_role(&delegate, &target, &role::MINTER),
        Err(Ok(host_error(ContractError::NotAuthorized)))
    );
    assert!(!client.has_role(&target, &role::MINTER));
}

#[test]
fn test_non_owner_cannot_revoke_roles() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let minter = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.grant_role(&admin, &minter, &role::MINTER);

    assert_eq!(
        client.try_revoke_role(&stranger, &minter, &role::MINTER),
        Err(Ok(host_error(ContractError::NotAuthorized)))
    );
    assert!(client.has_role(&minter, &role::MINTER));

    // The owner's own roles can't be stripped by a non-owner either.
    assert_eq!(
        client.try_revoke_role(&stranger, &admin, &role::OWNER),
        Err(Ok(host_error(ContractError::NotAuthorized)))
    );
    assert!(client.has_role(&admin, &role::OWNER));
}

#[test]
fn test_stranger_cannot_pause() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);

    let stranger = Address::generate(&env);
    assert_eq!(
        client.try_set_pause(&stranger, &true),
        Err(Ok(host_error(ContractError::NotAuthorized)))
    );
    assert!(!client.is_paused());
}

// ─── require_* helpers called directly ───────────────────────────────────────
//
// `require_burner` and `require_metadata_updater` are not yet called by any
// entrypoint, so they are exercised directly to pin down their contract.

#[test]
fn test_require_minter_rejects_caller_without_role() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let stranger = Address::generate(&env);

    env.as_contract(&client.address, || {
        assert_eq!(
            access_control::require_minter(&env, &stranger),
            Err(ContractError::NotMinter)
        );
        assert_eq!(access_control::require_minter(&env, &admin), Ok(()));
    });
}

#[test]
fn test_require_burner_rejects_caller_without_role() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let stranger = Address::generate(&env);
    let burner = Address::generate(&env);
    client.grant_role(&admin, &burner, &role::BURNER);

    env.as_contract(&client.address, || {
        assert_eq!(
            access_control::require_burner(&env, &stranger),
            Err(ContractError::NotBurner)
        );
        assert_eq!(access_control::require_burner(&env, &burner), Ok(()));
        assert_eq!(access_control::require_burner(&env, &admin), Ok(()));
    });

    client.revoke_role(&admin, &burner, &role::BURNER);
    env.as_contract(&client.address, || {
        assert_eq!(
            access_control::require_burner(&env, &burner),
            Err(ContractError::NotBurner)
        );
    });
}

#[test]
fn test_require_metadata_updater_rejects_caller_without_role() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);
    let stranger = Address::generate(&env);
    let updater = Address::generate(&env);
    let minter = Address::generate(&env);
    client.grant_role(&admin, &updater, &role::METADATA_UPDATER);
    client.grant_role(&admin, &minter, &role::MINTER);

    env.as_contract(&client.address, || {
        assert_eq!(
            access_control::require_metadata_updater(&env, &stranger),
            Err(ContractError::NotAuthorized)
        );
        // Other roles don't imply metadata-updater rights.
        assert_eq!(
            access_control::require_metadata_updater(&env, &minter),
            Err(ContractError::NotAuthorized)
        );
        assert_eq!(
            access_control::require_metadata_updater(&env, &updater),
            Ok(())
        );
    });

    client.revoke_role(&admin, &updater, &role::METADATA_UPDATER);
    env.as_contract(&client.address, || {
        assert_eq!(
            access_control::require_metadata_updater(&env, &updater),
            Err(ContractError::NotAuthorized)
        );
    });
}
