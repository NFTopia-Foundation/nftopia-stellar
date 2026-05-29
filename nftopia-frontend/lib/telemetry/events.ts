// Canonical event name constants and union

export const EVENT_NAMES = {
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
} as const;

export type TelemetryEventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
