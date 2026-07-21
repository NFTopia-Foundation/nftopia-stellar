  //
// Canonical event name constants and union

export const EVENT_NAMES = {
    walletConnectModalClosed: "wallet_connect_modal_closed",
    walletSessionRehydrateStarted: "wallet_session_rehydrate_started",
    walletSessionRehydrateSucceeded: "wallet_session_rehydrate_succeeded",
    walletSessionRehydrateFailed: "wallet_session_rehydrate_failed",
    walletProviderStateChanged: "wallet_provider_state_changed",
  walletConnectModalOpened: "wallet_connect_modal_opened",
  walletConnectProviderSelected: "wallet_connect_provider_selected",
  walletConnectSubmitted: "wallet_connect_submitted",
  walletConnectSucceeded: "wallet_connect_succeeded",
  walletConnectFailed: "wallet_connect_failed",
  walletDisconnectClicked: "wallet_disconnect_clicked",
  walletDisconnectSucceeded: "wallet_disconnect_succeeded",
  walletDisconnectFailed: "wallet_disconnect_failed",
  authLoginSubmitted: "auth_login_submitted",
  authLoginSucceeded: "auth_login_succeeded",
  authLoginFailed: "auth_login_failed",
  authRegisterSubmitted: "auth_register_submitted",
  authRegisterSucceeded: "auth_register_succeeded",
  authRegisterFailed: "auth_register_failed",
  collectionCreateSubmitted: "collection_create_submitted",
  collectionCreateSucceeded: "collection_create_succeeded",
  collectionCreateFailed: "collection_create_failed",
  mintNftSubmitted: "mint_nft_submitted",
  mintNftSucceeded: "mint_nft_succeeded",
  mintNftFailed: "mint_nft_failed",
  listingCreateSubmitted: "listing_create_submitted",
  listingCreateSucceeded: "listing_create_succeeded",
  listingCreateFailed: "listing_create_failed",
  ctaClicked: "cta_clicked",
  navItemClicked: "nav_item_clicked",
  sectionViewed: "section_viewed",
  experimentExposed: "experiment_exposed",
  experimentInteraction: "experiment_interaction",
  experimentConversion: "experiment_conversion",
  experimentAssignmentInfo: "experiment_assignment_info",
  creatorDashboardError: "creator_dashboard_error",
  pageNotFound: "page_not_found",
} as const;

export type TelemetryEventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

// Experiment event payload types
export interface ExperimentExposedPayload {
  experiment_id: string;
  experiment_name: string;
  variant_id: string;
  variant_name: string;
  variant_version: number;
  surface: string;
  placement_category: string;
  cta_label?: string;
  cta_icon?: string;
  cta_color_scheme?: string;
  cta_size?: string;
  cta_position?: string;
  assigned_at_timestamp_ms: number;
  is_control: boolean;
  target_user_segment?: string;
  rollout_percentage?: number;
  exposure_session_id: string;
  experiment_session_id: string;
}

export interface ExperimentInteractionPayload {
  experiment_id: string;
  variant_id: string;
  interaction_type: 'click' | 'hover' | 'focus' | 'dismiss';
  interaction_timestamp_ms: number;
  time_to_interaction_ms: number;
  surface: string;
  placement_category: string;
  is_control: boolean;
  exposure_session_id: string;
  interaction_sequence: number;
}

export interface ExperimentConversionPayload {
  experiment_id: string;
  variant_id: string;
  conversion_type: string;
  conversion_value?: number;
  conversion_timestamp_ms: number;
  time_from_exposure_to_conversion_ms: number;
  interaction_occurred: boolean;
  exposure_session_id: string;
  experiment_session_id?: string;
  funnel_stage_at_conversion?: string;
  conversion_id: string;
}

export interface ExperimentAssignmentInfoPayload {
  active_experiments: Array<{
    experiment_id: string;
    variant_id: string;
    variant_name: string;
    assigned_at_timestamp_ms: number;
    is_control: boolean;
  }>;
  assignment_seed: string;
}
