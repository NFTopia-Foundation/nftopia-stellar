#![cfg(test)]

use crate::{NftContract, NftContractClient};
use soroban_sdk::{Address, Env, String, Vec, testutils::Address as _};

fn create_contract(env: &Env) -> NftContractClient {
    let contract_id = env.register_contract(None, NftContract);
    NftContractClient::new(env, &contract_id)
}

#[test]
fn test_mint_and_transfer_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Grant Minter role to user1 (role 2)
    client.grant_role(&2, &user1);

    let id = client.mint(
        &user1,
        &String::from_str(&env, "ipfs://test"),
        &Vec::new(&env),
        &None,
    );
    assert_eq!(id, 1);

    client.safe_transfer_from(&user1, &user2, &id, &None);
    client.burn(&id, &true);
}

#[test]
fn test_royalties() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let creator = Address::generate(&env);

    client.set_default_royalty(&creator, &500);

    let (recipient, amount) = client.get_royalty_info(&1, &10000);
    assert_eq!(recipient, creator);
    assert_eq!(amount, 500);
}
