"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractError = void 0;
/**
 * Error Enum: ContractError
 */
exports.ContractError = {
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
