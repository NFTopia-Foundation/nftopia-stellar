use soroban_sdk::{contracttype, Address, String as SorobanString, Vec, Map};

/// Token attribute for on-chain metadata
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenAttribute {
    pub trait_type: SorobanString,
    pub value: SorobanString,
    pub display_type: Option<SorobanString>, // "number", "date", "boost_percentage"
}

/// Core NFT token data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenData {
    pub id: u64,
    pub owner: Address,
    pub approved: Option<Address>,
    pub metadata_uri: SorobanString,
    pub created_at: u64,
    pub creator: Address,
    pub royalty_percentage: u32, // Basis points (0-10000)
    pub royalty_recipient: Address,
    pub attributes: Vec<TokenAttribute>,
    pub edition_number: Option<u32>, // For limited editions
    pub total_editions: Option<u32>, // For limited editions
}

/// Royalty information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltyInfo {
    pub recipient: Address,
    pub percentage: u32, // Basis points (0-10000)
}

impl TokenData {
    pub fn new(
        id: u64,
        owner: Address,
        metadata_uri: SorobanString,
        creator: Address,
        royalty_info: RoyaltyInfo,
        attributes: Vec<TokenAttribute>,
        edition_info: Option<(u32, u32)>,
    ) -> Self {
        let (edition_number, total_editions) = match edition_info {
            Some((num, total)) => (Some(num), Some(total)),
            None => (None, None),
        };

        Self {
            id,
            owner,
            approved: None,
            metadata_uri,
            created_at: 0,
            creator,
            royalty_percentage: royalty_info.percentage,
            royalty_recipient: royalty_info.recipient,
            attributes,
            edition_number,
            total_editions,
        }
    }

    pub fn validate(&self) -> bool {
        // Validate royalty (0-10000 basis points)
        self.royalty_percentage <= 10000
    }

    pub fn is_edition(&self) -> bool {
        self.edition_number.is_some() && self.total_editions.is_some()
    }
}

impl RoyaltyInfo {
    pub fn new(recipient: Address, percentage: u32) -> Self {
        Self {
            recipient,
            percentage,
        }
    }

    pub fn validate(&self) -> bool {
        // Royalty must be 0-10000 basis points
        self.percentage <= 10000
    }

    pub fn calculate_royalty(&self, sale_price: i128) -> Result<i128, crate::error::ContractError> {
        if !self.validate() {
            return Err(crate::error::ContractError::InvalidRoyaltyPercentage);
        }

        if self.percentage == 0 {
            return Ok(0);
        }

        // Calculate: (sale_price * percentage) / 10000
        let royalty = sale_price
            .checked_mul(self.percentage as i128)
            .ok_or(crate::error::ContractError::RoyaltyOverflow)?
            .checked_div(10000)
            .ok_or(crate::error::ContractError::RoyaltyOverflow)?;

        Ok(royalty)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, symbol_short};

    #[test]
    fn test_royalty_calculation() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let royalty_info = RoyaltyInfo::new(recipient.clone(), 500); // 5%

        // Test 5% royalty on 1000 stroops
        let sale_price = 1000i128;
        let royalty = royalty_info.calculate_royalty(sale_price).unwrap();
        assert_eq!(royalty, 50); // 5% of 1000 = 50

        // Test 10% royalty on 10000 stroops
        let royalty_info_10 = RoyaltyInfo::new(recipient.clone(), 1000); // 10%
        let royalty_10 = royalty_info_10.calculate_royalty(10000i128).unwrap();
        assert_eq!(royalty_10, 1000); // 10% of 10000 = 1000

        // Test 0% royalty
        let royalty_info_0 = RoyaltyInfo::new(recipient, 0);
        let royalty_0 = royalty_info_0.calculate_royalty(1000i128).unwrap();
        assert_eq!(royalty_0, 0);
    }

    #[test]
    fn test_royalty_validation() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        // Valid royalty (5%)
        let valid = RoyaltyInfo::new(recipient.clone(), 500);
        assert!(valid.validate());

        // Valid royalty (100%)
        let valid_100 = RoyaltyInfo::new(recipient.clone(), 10000);
        assert!(valid_100.validate());

        // Invalid royalty (>100%)
        let invalid = RoyaltyInfo::new(recipient, 10001);
        assert!(!invalid.validate());
    }
}
