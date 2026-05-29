import { TelemetryEventName } from "./events";

export interface TelemetryPayloadMap {
  wallet_connect_modal_opened: {
    surface: "modal" | "header" | "settings";
  };
  wallet_connect_provider_selected: {
    provider: "freighter" | "albedo" | "walletconnect";
    surface: "modal" | "header" | "settings";
  };
  wallet_connect_submitted: {
    provider: "freighter" | "albedo" | "walletconnect";
    surface: "modal" | "header" | "settings";
  };
  wallet_connect_succeeded: {
    provider: "freighter" | "albedo" | "walletconnect";
    latency_ms: number;
  };
  wallet_connect_failed: {
    provider: "freighter" | "albedo" | "walletconnect";
    error_code: string;
    latency_ms?: number;
  };
  wallet_disconnect_clicked: {
    provider: "freighter" | "albedo" | "walletconnect";
  };
  wallet_disconnect_succeeded: {
    provider: "freighter" | "albedo" | "walletconnect";
  };
  wallet_disconnect_failed: {
    provider: "freighter" | "albedo" | "walletconnect";
    error_code: string;
  };

  auth_login_submitted: {
    auth_method: "email" | "wallet";
    surface: "login_page" | "modal";
    attempt_id: string;
  };
  auth_login_succeeded: {
    auth_method: "email" | "wallet";
    latency_ms: number;
    attempt_id: string;
    had_wallet_connected: boolean;
  };
  auth_login_failed: {
    auth_method: "email" | "wallet";
    attempt_id: string;
    latency_ms: number;
    error_code: string;
    failure_stage: "validation" | "request" | "response" | "state_sync";
    validation_error_count?: number;
  };
  auth_register_submitted: {
    auth_method: "email" | "wallet";
    surface: "register_page" | "modal";
    attempt_id: string;
    has_optional_username: boolean;
    has_connected_wallet: boolean;
  };
  auth_register_succeeded: {
    auth_method: "email" | "wallet";
    attempt_id: string;
    latency_ms: number;
    redirects_to_login: boolean;
  };
  auth_register_failed: {
    auth_method: "email" | "wallet";
    attempt_id: string;
    latency_ms: number;
    error_code: string;
    failure_stage: "validation" | "csrf" | "request" | "response";
    validation_error_count?: number;
  };
  collection_create_submitted: {
    collection_id: string;
    surface: "modal" | "dashboard";
  };
  collection_create_succeeded: {
    collection_id: string;
    latency_ms: number;
  };
  collection_create_failed: {
    collection_id: string;
    error_code: string;
    latency_ms?: number;
  };
  mint_nft_submitted: {
    collection_id: string;
    nft_id: string;
    surface: "modal" | "dashboard";
  };
  mint_nft_succeeded: {
    collection_id: string;
    nft_id: string;
    latency_ms: number;
  };
  mint_nft_failed: {
    collection_id: string;
    nft_id: string;
    error_code: string;
    latency_ms?: number;
  };
  listing_create_submitted: {
    listing_id: string;
    nft_id: string;
    surface: "modal" | "dashboard";
  };
  listing_create_succeeded: {
    listing_id: string;
    nft_id: string;
    latency_ms: number;
  };
  listing_create_failed: {
    listing_id: string;
    nft_id: string;
    error_code: string;
    latency_ms?: number;
  };
  cta_clicked: {
    cta_id: string;
    placement: string;
    destination_route?: string;
  };
  nav_item_clicked: {
    nav_id: string;
    placement: string;
    destination_route?: string;
  };
  section_viewed: {
    section_id: string;
    placement: string;
  };
}

export type TelemetryPayload<T extends TelemetryEventName> =
  T extends keyof TelemetryPayloadMap ? TelemetryPayloadMap[T] : never;
