import { TelemetryEventName } from "./events";

export interface TelemetryPayloadMap {
  wallet_connect_modal_opened: {
    surface: "modal";
    trigger_source: "header_button" | "cta" | "forced_prompt" | "other";
  };
  wallet_connect_modal_closed: {
    close_reason: "backdrop_click" | "escape_key" | "close_button" | "connect_success" | "route_change";
  };
  wallet_connect_provider_selected: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    provider_available: boolean;
  };
  wallet_connect_submitted: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    surface: "modal";
    attempt_id: string;
  };
  wallet_connect_succeeded: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    latency_ms: number;
    attempt_id: string;
    network: "public" | "testnet" | "unknown";
    connected_via: "fresh_connect" | "session_rehydrate";
  };
  wallet_connect_failed: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    attempt_id: string;
    latency_ms: number;
    error_code: string;
    is_retryable: boolean;
  };
  wallet_disconnect_clicked: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    surface: "wallet_dropdown" | "user_menu" | "settings";
  };
  wallet_disconnect_succeeded: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    latency_ms: number;
    initiated_by: "user" | "provider_event" | "rehydrate_check";
  };
  wallet_disconnect_failed: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    latency_ms: number;
    error_code: string;
  };
  wallet_session_rehydrate_started: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
  };
  wallet_session_rehydrate_succeeded: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    latency_ms: number;
  };
  wallet_session_rehydrate_failed: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    error_code: string;
    forced_disconnect: boolean;
  };
  wallet_provider_state_changed: {
    provider: "freighter" | "albedo" | "walletconnect" | "unknown";
    change_type: "account_changed" | "network_changed";
    outcome: "updated" | "disconnected";
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
  creator_dashboard_error: {
    error_message: string;
    component_name: string;
    surface: "creator-dashboard";
    status: "layout_crashed" | "widget_crashed";
  };
}

export type TelemetryPayload<T extends TelemetryEventName> =
  T extends keyof TelemetryPayloadMap ? TelemetryPayloadMap[T] : never;
