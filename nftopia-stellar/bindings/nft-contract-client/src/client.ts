import {ContractError, TokenAttribute, RoyaltyInfo, CollectionConfig, TokenData, ContractEvent} from './types.js';
import {Result, Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';

export interface Client {
  burn(args: { caller: string | Address; token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  mint(args: { caller: string | Address; to: string | Address; metadata_uri: string; attributes: Array<TokenAttribute>; royalty_override: RoyaltyInfo | null }, options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, ContractError>>>;
  approve(args: { owner: string | Address; approved: string | Address; token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  /**
   * Returns the semver string with embedded git commit: "0.1.0+abc1234"
   */
  version(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  has_role(args: { address: string | Address; role: number }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  owner_of(args: { token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, ContractError>>>;
  transfer(args: { caller: string | Address; from: string | Address; to: string | Address; token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  is_paused(options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  set_pause(args: { caller: string | Address; paused: boolean }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  token_uri(args: { token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<string, ContractError>>>;
  balance_of(args: { owner: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  batch_burn(args: { caller: string | Address; token_ids: Array<bigint> }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  batch_mint(args: { caller: string | Address; recipients: Array<string | Address>; metadata_uris: Array<string>; attributes: Array<Array<TokenAttribute>> }, options?: MethodOptions): Promise<AssembledTransaction<Result<Array<bigint>, ContractError>>>;
  grant_role(args: { caller: string | Address; target: string | Address; role: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  initialize(args: { admin: string | Address; config: CollectionConfig; default_royalty: RoyaltyInfo | null }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  /**
   * Returns full build metadata for incident response:
   * "version=0.1.0;git=abc1234;ts=1700000000;rustc=rustc 1.x.y"
   */
  get_version(options?: MethodOptions): Promise<AssembledTransaction<string>>;
  revoke_role(args: { caller: string | Address; target: string | Address; role: number }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
  get_approved(args: { token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<string | null>>;
  set_base_uri(args: { caller: string | Address; base_uri: string }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  total_supply(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  set_token_uri(args: { caller: string | Address; token_id: bigint; uri: string }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  batch_transfer(args: { caller: string | Address; from: string | Address; to: string | Address; token_ids: Array<bigint> }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  /**
   * Gets the current supply cap.
   */
  get_max_supply(options?: MethodOptions): Promise<AssembledTransaction<Result<bigint, ContractError>>>;
  token_metadata(args: { token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<TokenData, ContractError>>>;
  freeze_metadata(args: { caller: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  get_royalty_info(args: { token_id: bigint; sale_price: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<[string, bigint], ContractError>>>;
  /**
   * Gets the remaining supply available for minting.
   */
  remaining_supply(options?: MethodOptions): Promise<AssembledTransaction<bigint>>;
  set_token_royalty(args: { caller: string | Address; token_id: bigint; recipient: string | Address; percentage: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
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
  update_max_supply(args: { caller: string | Address; new_cap: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  is_metadata_frozen(options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  safe_transfer_from(args: { caller: string | Address; from: string | Address; to: string | Address; token_id: bigint }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  supports_interface(args: { interface_id: number }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  is_approved_for_all(args: { owner: string | Address; operator: string | Address }, options?: MethodOptions): Promise<AssembledTransaction<boolean>>;
  set_default_royalty(args: { caller: string | Address; recipient: string | Address; percentage: number }, options?: MethodOptions): Promise<AssembledTransaction<Result<[], ContractError>>>;
  set_approval_for_all(args: { owner: string | Address; operator: string | Address; approved: boolean }, options?: MethodOptions): Promise<AssembledTransaction<void>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==", "AAAAAAAAAAAAAAAEbWludAAAAAUAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAADG1ldGFkYXRhX3VyaQAAABAAAAAAAAAACmF0dHJpYnV0ZXMAAAAAA+oAAAfQAAAADlRva2VuQXR0cmlidXRlAAAAAAAAAAAAEHJveWFsdHlfb3ZlcnJpZGUAAAPoAAAH0AAAAAtSb3lhbHR5SW5mbwAAAAABAAAD6QAAAAYAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACGFwcHJvdmVkAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==", "AAAAAAAAAENSZXR1cm5zIHRoZSBzZW12ZXIgc3RyaW5nIHdpdGggZW1iZWRkZWQgZ2l0IGNvbW1pdDogIjAuMS4wK2FiYzEyMzQiAAAAAAd2ZXJzaW9uAAAAAAAAAAABAAAAEA==", "AAAAAAAAAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABHJvbGUAAAAEAAAAAQAAAAE=", "AAAAAAAAAAAAAAAIb3duZXJfb2YAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAYAAAABAAAD6QAAABMAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==", "AAAAAAAAAAAAAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB", "AAAAAAAAAAAAAAAJc2V0X3BhdXNlAAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZwYXVzZWQAAAAAAAEAAAAA", "AAAAAAAAAAAAAAAJdG9rZW5fdXJpAAAAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAQAAA+kAAAAQAAAH0AAAAA1Db250cmFjdEVycm9yAAAA", "AAAAAAAAAAAAAAAKYmFsYW5jZV9vZgAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAY=", "AAAAAAAAAAAAAAAKYmF0Y2hfYnVybgAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAl0b2tlbl9pZHMAAAAAAAPqAAAABgAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAKYmF0Y2hfbWludAAAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAApyZWNpcGllbnRzAAAAAAPqAAAAEwAAAAAAAAANbWV0YWRhdGFfdXJpcwAAAAAAA+oAAAAQAAAAAAAAAAphdHRyaWJ1dGVzAAAAAAPqAAAD6gAAB9AAAAAOVG9rZW5BdHRyaWJ1dGUAAAAAAAEAAAPpAAAD6gAAAAYAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZ0YXJnZXQAAAAAABMAAAAAAAAABHJvbGUAAAAEAAAAAA==", "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZjb25maWcAAAAAB9AAAAAQQ29sbGVjdGlvbkNvbmZpZwAAAAAAAAAPZGVmYXVsdF9yb3lhbHR5AAAAA+gAAAfQAAAAC1JveWFsdHlJbmZvAAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAG5SZXR1cm5zIGZ1bGwgYnVpbGQgbWV0YWRhdGEgZm9yIGluY2lkZW50IHJlc3BvbnNlOgoidmVyc2lvbj0wLjEuMDtnaXQ9YWJjMTIzNDt0cz0xNzAwMDAwMDAwO3J1c3RjPXJ1c3RjIDEueC55IgAAAAAAC2dldF92ZXJzaW9uAAAAAAAAAAABAAAAEA==", "AAAAAAAAAAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZ0YXJnZXQAAAAAABMAAAAAAAAABHJvbGUAAAAEAAAAAA==", "AAAAAAAAAAAAAAAMZ2V0X2FwcHJvdmVkAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAQAAA+gAAAAT", "AAAAAAAAAAAAAAAMc2V0X2Jhc2VfdXJpAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAhiYXNlX3VyaQAAABAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA", "AAAAAAAAAAAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAG", "AAAAAAAAAAAAAAANc2V0X3Rva2VuX3VyaQAAAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAAAAAAN1cmkAAAAAEAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAOYmF0Y2hfdHJhbnNmZXIAAAAAAAQAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAl0b2tlbl9pZHMAAAAAAAPqAAAABgAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAABxHZXRzIHRoZSBjdXJyZW50IHN1cHBseSBjYXAuAAAADmdldF9tYXhfc3VwcGx5AAAAAAAAAAAAAQAAA+kAAAAGAAAH0AAAAA1Db250cmFjdEVycm9yAAAA", "AAAAAAAAAAAAAAAOdG9rZW5fbWV0YWRhdGEAAAAAAAEAAAAAAAAACHRva2VuX2lkAAAABgAAAAEAAAPpAAAH0AAAAAlUb2tlbkRhdGEAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAPZnJlZXplX21ldGFkYXRhAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAAAAAAAQZ2V0X3JveWFsdHlfaW5mbwAAAAIAAAAAAAAACHRva2VuX2lkAAAABgAAAAAAAAAKc2FsZV9wcmljZQAAAAAACwAAAAEAAAPpAAAD7QAAAAIAAAATAAAACwAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==", "AAAAAAAAADBHZXRzIHRoZSByZW1haW5pbmcgc3VwcGx5IGF2YWlsYWJsZSBmb3IgbWludGluZy4AAAAQcmVtYWluaW5nX3N1cHBseQAAAAAAAAABAAAABg==", "AAAAAAAAAAAAAAARc2V0X3Rva2VuX3JveWFsdHkAAAAAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACHRva2VuX2lkAAAABgAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAKcGVyY2VudGFnZQAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=", "AAAAAAAAAixVcGRhdGVzIHRoZSBtYXhpbXVtIHN1cHBseSBjYXAgZm9yIHRoZSBjb2xsZWN0aW9uLgoKIyBBdXRob3JpemF0aW9uCk9ubHkgdGhlIGNvbnRyYWN0IGFkbWluIGNhbiBjYWxsIHRoaXMgZnVuY3Rpb24uCgojIFZhbGlkYXRpb24KLSBOZXcgY2FwIG11c3QgYmUgPj0gTUlOX1NVUFBMWV9DQVAgKDEpCi0gTmV3IGNhcCBtdXN0IGJlIDw9IE1BWF9TVVBQTFlfSEFSRF9DQVAgKDEsMDAwLDAwMCkKLSBOZXcgY2FwIG11c3QgYmUgPj0gY3VycmVudCB0b3RhbCBzdXBwbHkgKGNhbm5vdCByZWR1Y2UgYmVsb3cgZXhpc3Rpbmcgc3VwcGx5KQoKIyBFdmVudHMKRW1pdHMgYFN1cHBseUNhcFVwZGF0ZWRgIG9uIHN1Y2Nlc3MuCgojIEVycm9ycwotIGBOb3RBdXRob3JpemVkYCBpZiBjYWxsZXIgaXMgbm90IGFkbWluCi0gYFN1cHBseUNhcFRvb0xvd2AgaWYgY2FwIDwgTUlOX1NVUFBMWV9DQVAKLSBgU3VwcGx5Q2FwVG9vSGlnaGAgaWYgY2FwID4gTUFYX1NVUFBMWV9IQVJEX0NBUAotIGBTdXBwbHlDYXBCZWxvd0N1cnJlbnRTdXBwbHlgIGlmIGNhcCA8IGN1cnJlbnQgdG90YWwgc3VwcGx5AAAAEXVwZGF0ZV9tYXhfc3VwcGx5AAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAduZXdfY2FwAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA", "AAAAAAAAAAAAAAASaXNfbWV0YWRhdGFfZnJvemVuAAAAAAAAAAAAAQAAAAE=", "AAAAAAAAAAAAAAASc2FmZV90cmFuc2Zlcl9mcm9tAAAAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==", "AAAAAAAAAAAAAAASc3VwcG9ydHNfaW50ZXJmYWNlAAAAAAABAAAAAAAAAAxpbnRlcmZhY2VfaWQAAAAEAAAAAQAAAAE=", "AAAAAAAAAAAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB", "AAAAAAAAAAAAAAATc2V0X2RlZmF1bHRfcm95YWx0eQAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAACnBlcmNlbnRhZ2UAAAAAAAQAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA", "AAAAAAAAAAAAAAAUc2V0X2FwcHJvdmFsX2Zvcl9hbGwAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAAAAAAIYXBwcm92ZWQAAAABAAAAAA==", "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAdAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAAAAQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAACAAAAAAAAAAhOb3RGb3VuZAAAAAMAAAAAAAAADVRva2VuTm90Rm91bmQAAAAAAAAEAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAABQAAAAAAAAATU3VwcGx5TGltaXRFeGNlZWRlZAAAAAAGAAAAAAAAAA5Db250cmFjdFBhdXNlZAAAAAAABwAAAAAAAAAOSW52YWxpZFJveWFsdHkAAAAAAAgAAAAAAAAAElRva2VuQWxyZWFkeUV4aXN0cwAAAAAACQAAAAAAAAAOTWV0YWRhdGFGcm96ZW4AAAAAAAoAAAAAAAAACE5vdE93bmVyAAAACwAAAAAAAAALTm90QXBwcm92ZWQAAAAADAAAAAAAAAAQSW52YWxpZEJhdGNoU2l6ZQAAAA0AAAAAAAAADUJhdGNoVG9vTGFyZ2UAAAAAAAAOAAAAAAAAABBJbnZhbGlkUmVjaXBpZW50AAAADwAAAAAAAAASUm9sZUFscmVhZHlHcmFudGVkAAAAAAAQAAAAAAAAAA5Sb2xlTm90R3JhbnRlZAAAAAAAEQAAAAAAAAAJTm90TWludGVyAAAAAAAAEgAAAAAAAAAJTm90QnVybmVyAAAAAAAAEwAAAAAAAAAKSW52YWxpZFVyaQAAAAAAFAAAAAAAAAAPQXJpdGhtZXRpY0Vycm9yAAAAABUAAAAAAAAAEE1pc21hdGNoZWRBcnJheXMAAAAWAAAAAAAAAA1BbHJlYWR5QnVybmVkAAAAAAAAFwAAAAAAAAAOQnVybk5vdEFsbG93ZWQAAAAAABgAAAAzU3VwcGx5IGNhcCBjYW5ub3QgYmUgemVyby4gTWluaW11bSBzdXBwbHkgY2FwIGlzIDEuAAAAAA9TdXBwbHlDYXBUb29Mb3cAAAAAHgAAAEJTdXBwbHkgY2FwIGV4Y2VlZHMgdGhlIGhhcmQgY2FwIChNQVhfU1VQUExZX0hBUkRfQ0FQID0gMSwwMDAsMDAwKS4AAAAAABBTdXBwbHlDYXBUb29IaWdoAAAAHwAAAF1DYW5ub3QgcmVkdWNlIHN1cHBseSBjYXAgYmVsb3cgY3VycmVudCB0b3RhbCBzdXBwbHkuCk5ldyBjYXAgbXVzdCBiZSA+PSBjdXJyZW50IHRvdGFsIHN1cHBseS4AAAAAAAAbU3VwcGx5Q2FwQmVsb3dDdXJyZW50U3VwcGx5AAAAACAAAABtU3VwcGx5IGNhcCBpcyByZXF1aXJlZCBidXQgd2FzIG5vdCBzZXQgKHNob3VsZCBuZXZlciBoYXBwZW4gYWZ0ZXIKbWlncmF0aW9uLCBhcyBtYXhfc3VwcGx5IGlzIG5vdyBtYW5kYXRvcnkpLgAAAAAAAA9TdXBwbHlDYXBOb3RTZXQAAAAAIQAAAD1tYXhfc3VwcGx5IGV4Y2VlZHMgTUFYX1NVUFBMWV9IQVJEX0NBUCBkdXJpbmcgaW5pdGlhbGl6YXRpb24uAAAAAAAAF01heFN1cHBseUV4Y2VlZHNIYXJkQ2FwAAAAACI=", "AAAAAQAAAAAAAAAAAAAACVRva2VuRGF0YQAAAAAAAAoAAAAAAAAACmF0dHJpYnV0ZXMAAAAAA+oAAAfQAAAADlRva2VuQXR0cmlidXRlAAAAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAAB2NyZWF0b3IAAAAAEwAAAAAAAAAOZWRpdGlvbl9udW1iZXIAAAAAA+gAAAAEAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAABJyb3lhbHR5X3BlcmNlbnRhZ2UAAAAAAAQAAAAAAAAAEXJveWFsdHlfcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAOdG90YWxfZWRpdGlvbnMAAAAAA+gAAAAE", "AAAAAQAAAAAAAAAAAAAAC1JveWFsdHlJbmZvAAAAAAIAAAAAAAAACnBlcmNlbnRhZ2UAAAAAAAQAAAAAAAAACXJlY2lwaWVudAAAAAAAABM=", "AAAAAQAAAAAAAAAAAAAADlRva2VuQXR0cmlidXRlAAAAAAADAAAAAAAAAAxkaXNwbGF5X3R5cGUAAAPoAAAAEAAAAAAAAAAKdHJhaXRfdHlwZQAAAAAAEAAAAAAAAAAFdmFsdWUAAAAAAAAQ", "AAAAAQAAAAAAAAAAAAAAEENvbGxlY3Rpb25Db25maWcAAAAHAAAAAAAAAAhiYXNlX3VyaQAAABAAAAAAAAAAC2lzX3JldmVhbGVkAAAAAAEAAACRTWF4aW11bSBzdXBwbHkgZm9yIHRoaXMgY29sbGVjdGlvbi4gTXVzdCBiZSBTb21lKG4pIHdoZXJlIG4gPiAwIGFuZCBuIDw9IE1BWF9TVVBQTFlfSEFSRF9DQVAuClRoaXMgaXMgbm93IG1hbmRhdG9yeSAtIE5vbmUgaXMgbm8gbG9uZ2VyIGFjY2VwdGVkLgAAAAAAAAptYXhfc3VwcGx5AAAAAAAGAAAAAAAAABJtZXRhZGF0YV9pc19mcm96ZW4AAAAAAAEAAAAAAAAACm1pbnRfcHJpY2UAAAAAA+gAAAALAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQ", "AAAABQAAAAAAAAAAAAAABEJ1cm4AAAABAAAABGJ1cm4AAAACAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAAAAAACHRva2VuX2lkAAAABgAAAAAAAAAC", "AAAABQAAAAAAAAAAAAAABE1pbnQAAAABAAAABG1pbnQAAAACAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAAAAAACHRva2VuX2lkAAAABgAAAAAAAAAC", "AAAABQAAAAAAAAAAAAAACEFwcHJvdmFsAAAAAQAAAAhhcHByb3ZhbAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAACGFwcHJvdmVkAAAAEwAAAAAAAAAAAAAACHRva2VuX2lkAAAABgAAAAAAAAAC", "AAAABQAAAAAAAAAAAAAACFRyYW5zZmVyAAAAAQAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAAAAAACdG8AAAAAABMAAAAAAAAAAAAAAAh0b2tlbl9pZAAAAAYAAAAAAAAAAg==", "AAAABQAAAAAAAAAAAAAACkJ1cm5GYWlsZWQAAAAAAAEAAAALYnVybl9mYWlsZWQAAAAAAwAAAAAAAAAIdG9rZW5faWQAAAAGAAAAAAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAAAAAAGcmVhc29uAAAAAAAEAAAAAAAAAAI=", "AAAABQAAAAAAAAAAAAAADVJveWFsdHlVcGRhdGUAAAAAAAABAAAADnJveWFsdHlfdXBkYXRlAAAAAAACAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAAAAAAKcGVyY2VudGFnZQAAAAAABAAAAAAAAAAC", "AAAABQAAAAAAAAAAAAAADkFwcHJvdmFsRm9yQWxsAAAAAAABAAAAEGFwcHJvdmFsX2Zvcl9hbGwAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAAAAAAAAAAAAhhcHByb3ZlZAAAAAEAAAAAAAAAAg==", "AAAABQAAAAAAAAAAAAAADk1ldGFkYXRhVXBkYXRlAAAAAAABAAAAD21ldGFkYXRhX3VwZGF0ZQAAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAYAAAAAAAAAAg==", "AAAABQAAAD5FbWl0dGVkIHdoZW4gdGhlIHN1cHBseSBjYXAgaXMgcmVhY2hlZCAocmVtYWluaW5nIHN1cHBseSA9IDApLgAAAAAAAAAAABBTdXBwbHlDYXBSZWFjaGVkAAAAAQAAABJzdXBwbHlfY2FwX3JlYWNoZWQAAAAAAAIAAAAAAAAADHRvdGFsX3N1cHBseQAAAAYAAAAAAAAAAAAAAAptYXhfc3VwcGx5AAAAAAAGAAAAAAAAAAI=", "AAAABQAAADRFbWl0dGVkIHdoZW4gdGhlIHN1cHBseSBjYXAgaXMgdXBkYXRlZCBieSB0aGUgYWRtaW4uAAAAAAAAABBTdXBwbHlDYXBVcGRhdGVkAAAAAQAAABJzdXBwbHlfY2FwX3VwZGF0ZWQAAAAAAAMAAAAAAAAAB29sZF9jYXAAAAAABgAAAAAAAAAAAAAAB25ld19jYXAAAAAABgAAAAAAAAAAAAAACnVwZGF0ZWRfYXQAAAAAAAYAAAAAAAAAAg==", "AAAABQAAAD5FbWl0dGVkIHdoZW4gdGhlIHJlbWFpbmluZyBzdXBwbHkgZHJvcHMgdG8gb3IgYmVsb3cgMTAgdG9rZW5zLgAAAAAAAAAAABRTdXBwbHlBcHByb2FjaGluZ0NhcAAAAAEAAAAWc3VwcGx5X2FwcHJvYWNoaW5nX2NhcAAAAAAAAgAAAAAAAAAJcmVtYWluaW5nAAAAAAAABgAAAAAAAAAAAAAACXRvdGFsX2NhcAAAAAAAAAYAAAAAAAAAAg==", "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAEQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAQQ29sbGVjdGlvbkNvbmZpZwAAAAAAAAAAAAAAC1RvdGFsU3VwcGx5AAAAAAAAAAAAAAAAC05leHRUb2tlbklkAAAAAAAAAAAAAAAACElzUGF1c2VkAAAAAAAAAAAAAAAOTWV0YWRhdGFGcm96ZW4AAAAAAAAAAAAAAAAAB0Jhc2VVcmkAAAAAAQAAAAAAAAAJVG9rZW5EYXRhAAAAAAAAAQAAAAYAAAABAAAAAAAAAApUb2tlbk93bmVyAAAAAAABAAAABgAAAAEAAAAAAAAADVRva2VuQXBwcm92ZWQAAAAAAAABAAAABgAAAAEAAAAAAAAAB0JhbGFuY2UAAAAAAQAAABMAAAABAAAAAAAAABBPcGVyYXRvckFwcHJvdmFsAAAAAgAAABMAAAATAAAAAQAAAAAAAAAEUm9sZQAAAAIAAAATAAAABAAAAAAAAAAAAAAADkRlZmF1bHRSb3lhbHR5AAAAAAABAAAAAAAAAAxUb2tlblJveWFsdHkAAAABAAAABgAAAAEAAAAAAAAADUxhc3RCYXRjaFRpbWUAAAAAAAABAAAAEwAAAAEAAAAAAAAACkJhdGNoQ291bnQAAAAAAAEAAAAT"]),
      options
    );
  }

   static deploy<T = Client>(options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Uint8Array; address?: string; } & ({ wasmHash: Uint8Array | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  public readonly fromJson = {
    burn : this.txFromJson<Result<[], ContractError>>,  mint : this.txFromJson<Result<bigint, ContractError>>,  approve : this.txFromJson<Result<[], ContractError>>,  version : this.txFromJson<string>,  has_role : this.txFromJson<boolean>,  owner_of : this.txFromJson<Result<string, ContractError>>,  transfer : this.txFromJson<Result<[], ContractError>>,  is_paused : this.txFromJson<boolean>,  set_pause : this.txFromJson<void>,  token_uri : this.txFromJson<Result<string, ContractError>>,  balance_of : this.txFromJson<bigint>,  batch_burn : this.txFromJson<Result<[], ContractError>>,  batch_mint : this.txFromJson<Result<Array<bigint>, ContractError>>,  grant_role : this.txFromJson<void>,  initialize : this.txFromJson<Result<[], ContractError>>,  get_version : this.txFromJson<string>,  revoke_role : this.txFromJson<void>,  get_approved : this.txFromJson<string | null>,  set_base_uri : this.txFromJson<Result<[], ContractError>>,  total_supply : this.txFromJson<bigint>,  set_token_uri : this.txFromJson<Result<[], ContractError>>,  batch_transfer : this.txFromJson<Result<[], ContractError>>,  get_max_supply : this.txFromJson<Result<bigint, ContractError>>,  token_metadata : this.txFromJson<Result<TokenData, ContractError>>,  freeze_metadata : this.txFromJson<Result<[], ContractError>>,  get_royalty_info : this.txFromJson<Result<[string, bigint], ContractError>>,  remaining_supply : this.txFromJson<bigint>,  set_token_royalty : this.txFromJson<Result<[], ContractError>>,  update_max_supply : this.txFromJson<Result<[], ContractError>>,  is_metadata_frozen : this.txFromJson<boolean>,  safe_transfer_from : this.txFromJson<Result<[], ContractError>>,  supports_interface : this.txFromJson<boolean>,  is_approved_for_all : this.txFromJson<boolean>,  set_default_royalty : this.txFromJson<Result<[], ContractError>>,  set_approval_for_all : this.txFromJson<void>
  };

  /** @deprecated Use fromJson instead. */
  public readonly fromJSON = this.fromJson;

  /**
   * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
   */
  parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined {
    return this.spec.parseEvent(topics, data) as ContractEvent | undefined;
  }
  /**
   * Build a topics filter row for the "Burn" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  burnEventFilter(): string[] {
    return this.spec.eventTopicFilter("Burn");
  }
  /**
   * Build a topics filter row for the "Mint" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  mintEventFilter(): string[] {
    return this.spec.eventTopicFilter("Mint");
  }
  /**
   * Build a topics filter row for the "Approval" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  approvalEventFilter(): string[] {
    return this.spec.eventTopicFilter("Approval");
  }
  /**
   * Build a topics filter row for the "Transfer" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  transferEventFilter(): string[] {
    return this.spec.eventTopicFilter("Transfer");
  }
  /**
   * Build a topics filter row for the "BurnFailed" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  burnFailedEventFilter(): string[] {
    return this.spec.eventTopicFilter("BurnFailed");
  }
  /**
   * Build a topics filter row for the "RoyaltyUpdate" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  royaltyUpdateEventFilter(): string[] {
    return this.spec.eventTopicFilter("RoyaltyUpdate");
  }
  /**
   * Build a topics filter row for the "ApprovalForAll" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  approvalForAllEventFilter(): string[] {
    return this.spec.eventTopicFilter("ApprovalForAll");
  }
  /**
   * Build a topics filter row for the "MetadataUpdate" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  metadataUpdateEventFilter(): string[] {
    return this.spec.eventTopicFilter("MetadataUpdate");
  }
  /**
   * Build a topics filter row for the "SupplyCapReached" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  supplyCapReachedEventFilter(): string[] {
    return this.spec.eventTopicFilter("SupplyCapReached");
  }
  /**
   * Build a topics filter row for the "SupplyCapUpdated" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  supplyCapUpdatedEventFilter(): string[] {
    return this.spec.eventTopicFilter("SupplyCapUpdated");
  }
  /**
   * Build a topics filter row for the "SupplyApproachingCap" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  supplyApproachingCapEventFilter(): string[] {
    return this.spec.eventTopicFilter("SupplyApproachingCap");
  }
}