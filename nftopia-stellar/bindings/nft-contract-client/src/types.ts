import { Address } from "@stellar/stellar-sdk";
export type ContractEvent = BurnEvent | MintEvent | ApprovalEvent | TransferEvent | BurnFailedEvent | RoyaltyUpdateEvent | ApprovalForAllEvent | MetadataUpdateEvent | SupplyCapReachedEvent | SupplyCapUpdatedEvent | SupplyApproachingCapEvent;
/**
 * Error Enum: ContractError
 */
export const ContractError = {
  1: { message: "NotAuthorized" },
  2: { message: "AlreadyInitialized" },
  3: { message: "NotFound" },
  4: { message: "TokenNotFound" },
  5: { message: "InvalidAmount" },
  6: { message: "SupplyLimitExceeded" },
  7: { message: "ContractPaused" },
  8: { message: "InvalidRoyalty" },
  9: { message: "TokenAlreadyExists" },
  10: { message: "MetadataFrozen" },
  11: { message: "NotOwner" },
  12: { message: "NotApproved" },
  13: { message: "InvalidBatchSize" },
  14: { message: "BatchTooLarge" },
  15: { message: "InvalidRecipient" },
  16: { message: "RoleAlreadyGranted" },
  17: { message: "RoleNotGranted" },
  18: { message: "NotMinter" },
  19: { message: "NotBurner" },
  20: { message: "InvalidUri" },
  21: { message: "ArithmeticError" },
  22: { message: "MismatchedArrays" },
  23: { message: "AlreadyBurned" },
  24: { message: "BurnNotAllowed" },
  /**
   * Supply cap cannot be zero. Minimum supply cap is 1.
   */
  30: { message: "SupplyCapTooLow" },
  /**
   * Supply cap exceeds the hard cap (MAX_SUPPLY_HARD_CAP = 1,000,000).
   */
  31: { message: "SupplyCapTooHigh" },
  /**
   * Cannot reduce supply cap below current total supply.
   * New cap must be >= current total supply.
   */
  32: { message: "SupplyCapBelowCurrentSupply" },
  /**
   * Supply cap is required but was not set (should never happen after
   * migration, as max_supply is now mandatory).
   */
  33: { message: "SupplyCapNotSet" },
  /**
   * max_supply exceeds MAX_SUPPLY_HARD_CAP during initialization.
   */
  34: { message: "MaxSupplyExceedsHardCap" },
};

export interface ContractError {
  message: string;
}

/**
 * Struct: TokenData
 */
export interface TokenData {
  attributes: Array<TokenAttribute>;
  created_at: bigint;
  creator: string;
  edition_number: number | null;
  id: bigint;
  metadata_uri: string;
  owner: string;
  royalty_percentage: number;
  royalty_recipient: string;
  total_editions: number | null;
}

/**
 * Struct: RoyaltyInfo
 */
export interface RoyaltyInfo {
  percentage: number;
  recipient: string;
}

/**
 * Struct: TokenAttribute
 */
export interface TokenAttribute {
  display_type: string | null;
  trait_type: string;
  value: string;
}

/**
 * Struct: CollectionConfig
 */
export interface CollectionConfig {
  base_uri: string;
  is_revealed: boolean;
  /**
   * Maximum supply for this collection. Must be Some(n) where n > 0 and n <= MAX_SUPPLY_HARD_CAP.
   * This is now mandatory - None is no longer accepted.
   */
  max_supply: bigint;
  metadata_is_frozen: boolean;
  mint_price: bigint | null;
  name: string;
  symbol: string;
}

/**
 * Event: Burn
 */
export interface BurnEvent {
  name: "Burn";
  data: {
    from?: string;
    token_id?: bigint;
  };
}

/**
 * Event: Mint
 */
export interface MintEvent {
  name: "Mint";
  data: {
    to?: string;
    token_id?: bigint;
  };
}

/**
 * Event: Approval
 */
export interface ApprovalEvent {
  name: "Approval";
  data: {
    owner?: string;
    approved?: string;
    token_id?: bigint;
  };
}

/**
 * Event: Transfer
 */
export interface TransferEvent {
  name: "Transfer";
  data: {
    from?: string;
    to?: string;
    token_id?: bigint;
  };
}

/**
 * Event: BurnFailed
 */
export interface BurnFailedEvent {
  name: "BurnFailed";
  data: {
    token_id?: bigint;
    caller?: string;
    reason?: number;
  };
}

/**
 * Event: RoyaltyUpdate
 */
export interface RoyaltyUpdateEvent {
  name: "RoyaltyUpdate";
  data: {
    recipient?: string;
    percentage?: number;
  };
}

/**
 * Event: ApprovalForAll
 */
export interface ApprovalForAllEvent {
  name: "ApprovalForAll";
  data: {
    owner?: string;
    operator?: string;
    approved?: boolean;
  };
}

/**
 * Event: MetadataUpdate
 */
export interface MetadataUpdateEvent {
  name: "MetadataUpdate";
  data: {
    token_id?: bigint;
  };
}

/**
 * Emitted when the supply cap is reached (remaining supply = 0).
 */
export interface SupplyCapReachedEvent {
  name: "SupplyCapReached";
  data: {
    total_supply?: bigint;
    max_supply?: bigint;
  };
}

/**
 * Emitted when the supply cap is updated by the admin.
 */
export interface SupplyCapUpdatedEvent {
  name: "SupplyCapUpdated";
  data: {
    old_cap?: bigint;
    new_cap?: bigint;
    updated_at?: bigint;
  };
}

/**
 * Emitted when the remaining supply drops to or below 10 tokens.
 */
export interface SupplyApproachingCapEvent {
  name: "SupplyApproachingCap";
  data: {
    remaining?: bigint;
    total_cap?: bigint;
  };
}

/**
 * Union: DataKey
 */
export type DataKey =
  | { tag: "Admin"; values: void }
  | { tag: "CollectionConfig"; values: void }
  | { tag: "TotalSupply"; values: void }
  | { tag: "NextTokenId"; values: void }
  | { tag: "IsPaused"; values: void }
  | { tag: "MetadataFrozen"; values: void }
  | { tag: "BaseUri"; values: void }
  | { tag: "TokenData"; values: readonly [bigint] }
  | { tag: "TokenOwner"; values: readonly [bigint] }
  | { tag: "TokenApproved"; values: readonly [bigint] }
  | { tag: "Balance"; values: readonly [string] }
  | { tag: "OperatorApproval"; values: readonly [string, string] }
  | { tag: "Role"; values: readonly [string, number] }
  | { tag: "DefaultRoyalty"; values: void }
  | { tag: "TokenRoyalty"; values: readonly [bigint] }
  | { tag: "LastBatchTime"; values: readonly [string] }
  | { tag: "BatchCount"; values: readonly [string] };
