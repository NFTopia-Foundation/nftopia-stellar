import { ContractError, TokenAttribute, RoyaltyInfo, CollectionConfig, TokenData, ContractEvent } from './types.js';
import { Result, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef } from '@stellar/stellar-sdk/contract';
import { Address, xdr } from '@stellar/stellar-sdk';
export interface Client {
    burn(args: {
        caller: string | Address;
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    mint(args: {
        caller: string | Address;
        to: string | Address;
        metadata_uri: string;
        attributes: Array<TokenAttribute>;
        royalty_override: RoyaltyInfo | null;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, ContractError>>>;
    approve(args: {
        owner: string | Address;
        approved: string | Address;
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    /**
     * Returns the semver string with embedded git commit: "0.1.0+abc1234"
     */
    version(options?: MethodOptions): Promise<AssembledTransaction<string>>;
    has_role(args: {
        address: string | Address;
        role: number;
    }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
    owner_of(args: {
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, ContractError>>>;
    transfer(args: {
        caller: string | Address;
        from: string | Address;
        to: string | Address;
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    is_paused(options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
    set_pause(args: {
        caller: string | Address;
        paused: boolean;
    }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
    token_uri(args: {
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, ContractError>>>;
    balance_of(args: {
        owner: string | Address;
    }, options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
    batch_burn(args: {
        caller: string | Address;
        token_ids: Array<bigint>;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    batch_mint(args: {
        caller: string | Address;
        recipients: Array<string | Address>;
        metadata_uris: Array<string>;
        attributes: Array<Array<TokenAttribute>>;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<Array<bigint>, ContractError>>>;
    grant_role(args: {
        caller: string | Address;
        target: string | Address;
        role: number;
    }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
    initialize(args: {
        admin: string | Address;
        config: CollectionConfig;
        default_royalty: RoyaltyInfo | null;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    /**
     * Returns full build metadata for incident response:
     * "version=0.1.0;git=abc1234;ts=1700000000;rustc=rustc 1.x.y"
     */
    get_version(options?: MethodOptions): Promise<AssembledTransaction<string>>;
    revoke_role(args: {
        caller: string | Address;
        target: string | Address;
        role: number;
    }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
    get_approved(args: {
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
    set_base_uri(args: {
        caller: string | Address;
        base_uri: string;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    total_supply(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
    set_token_uri(args: {
        caller: string | Address;
        token_id: bigint;
        uri: string;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    batch_transfer(args: {
        caller: string | Address;
        from: string | Address;
        to: string | Address;
        token_ids: Array<bigint>;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    /**
     * Gets the current supply cap.
     */
    get_max_supply(options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, ContractError>>>;
    token_metadata(args: {
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<TokenData, ContractError>>>;
    freeze_metadata(args: {
        caller: string | Address;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    get_royalty_info(args: {
        token_id: bigint;
        sale_price: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[string, bigint], ContractError>>>;
    /**
     * Gets the remaining supply available for minting.
     */
    remaining_supply(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
    set_token_royalty(args: {
        caller: string | Address;
        token_id: bigint;
        recipient: string | Address;
        percentage: number;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    /**
     * Updates the maximum supply cap for the collection.
     *
     * # Authorization
     * Only the contract admin can call this function.
     *
     * # Validation
     * - New cap must be >= MIN_SUPPLY_CAP (1)
     * - New cap must be <= MAX_SUPPLY_HARD_CAP (1,000,000)
     * - New cap must be >= current total supply (cannot reduce below existing supply)
     *
     * # Events
     * Emits `SupplyCapUpdated` on success.
     *
     * # Errors
     * - `NotAuthorized` if caller is not admin
     * - `SupplyCapTooLow` if cap < MIN_SUPPLY_CAP
     * - `SupplyCapTooHigh` if cap > MAX_SUPPLY_HARD_CAP
     * - `SupplyCapBelowCurrentSupply` if cap < current total supply
     */
    update_max_supply(args: {
        caller: string | Address;
        new_cap: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    is_metadata_frozen(options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
    safe_transfer_from(args: {
        caller: string | Address;
        from: string | Address;
        to: string | Address;
        token_id: bigint;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    supports_interface(args: {
        interface_id: number;
    }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
    is_approved_for_all(args: {
        owner: string | Address;
        operator: string | Address;
    }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
    set_default_royalty(args: {
        caller: string | Address;
        recipient: string | Address;
        percentage: number;
    }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
    set_approval_for_all(args: {
        owner: string | Address;
        operator: string | Address;
        approved: boolean;
    }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    constructor(options: ContractClientOptions);
    static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & {
        salt?: Uint8Array;
        address?: string;
    } & ({
        wasmHash: Uint8Array | string;
        format?: "hex" | "base64";
        externalRef?: never;
    } | {
        externalRef: ExternalExecutableRef;
        wasmHash?: never;
        format?: never;
    })): Promise<AssembledTransaction<T>>;
    readonly fromJson: {
        burn: any;
        mint: any;
        approve: any;
        version: any;
        has_role: any;
        owner_of: any;
        transfer: any;
        is_paused: any;
        set_pause: any;
        token_uri: any;
        balance_of: any;
        batch_burn: any;
        batch_mint: any;
        grant_role: any;
        initialize: any;
        get_version: any;
        revoke_role: any;
        get_approved: any;
        set_base_uri: any;
        total_supply: any;
        set_token_uri: any;
        batch_transfer: any;
        get_max_supply: any;
        token_metadata: any;
        freeze_metadata: any;
        get_royalty_info: any;
        remaining_supply: any;
        set_token_royalty: any;
        update_max_supply: any;
        is_metadata_frozen: any;
        safe_transfer_from: any;
        supports_interface: any;
        is_approved_for_all: any;
        set_default_royalty: any;
        set_approval_for_all: any;
    };
    /** @deprecated Use fromJson instead. */
    readonly fromJSON: {
        burn: any;
        mint: any;
        approve: any;
        version: any;
        has_role: any;
        owner_of: any;
        transfer: any;
        is_paused: any;
        set_pause: any;
        token_uri: any;
        balance_of: any;
        batch_burn: any;
        batch_mint: any;
        grant_role: any;
        initialize: any;
        get_version: any;
        revoke_role: any;
        get_approved: any;
        set_base_uri: any;
        total_supply: any;
        set_token_uri: any;
        batch_transfer: any;
        get_max_supply: any;
        token_metadata: any;
        freeze_metadata: any;
        get_royalty_info: any;
        remaining_supply: any;
        set_token_royalty: any;
        update_max_supply: any;
        is_metadata_frozen: any;
        safe_transfer_from: any;
        supports_interface: any;
        is_approved_for_all: any;
        set_default_royalty: any;
        set_approval_for_all: any;
    };
    /**
     * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
     */
    parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined;
    /**
     * Build a topics filter row for the "Burn" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    burnEventFilter(): string[];
    /**
     * Build a topics filter row for the "Mint" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    mintEventFilter(): string[];
    /**
     * Build a topics filter row for the "Approval" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    approvalEventFilter(): string[];
    /**
     * Build a topics filter row for the "Transfer" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    transferEventFilter(): string[];
    /**
     * Build a topics filter row for the "BurnFailed" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    burnFailedEventFilter(): string[];
    /**
     * Build a topics filter row for the "RoyaltyUpdate" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    royaltyUpdateEventFilter(): string[];
    /**
     * Build a topics filter row for the "ApprovalForAll" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    approvalForAllEventFilter(): string[];
    /**
     * Build a topics filter row for the "MetadataUpdate" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    metadataUpdateEventFilter(): string[];
    /**
     * Build a topics filter row for the "SupplyCapReached" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    supplyCapReachedEventFilter(): string[];
    /**
     * Build a topics filter row for the "SupplyCapUpdated" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    supplyCapUpdatedEventFilter(): string[];
    /**
     * Build a topics filter row for the "SupplyApproachingCap" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
     */
    supplyApproachingCapEventFilter(): string[];
}
