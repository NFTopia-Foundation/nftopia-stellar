import { config, isFeatureEnabled } from '@/src/config';

export const ANALYTICS_CONFIG = {
  // PostHog configuration
  posthog: {
    apiKey: config.analytics.posthogApiKey,
    host: config.analytics.posthogHost,
    debug: __DEV__,
    captureApplicationLifecycleEvents: true,
    captureScreenViews: true,
    captureTouches: false,
    captureDeepLinks: true,
  },

  // Feature flags
  features: {
    enableAnalytics: isFeatureEnabled('analytics'),
    enablePerformanceMonitoring: isFeatureEnabled('performanceMonitoring'),
    enableErrorTracking: isFeatureEnabled('errorTracking'),
    enableSessionReplay: false,
    enableConsentManagement: true,
  },

  // Event tracking settings
  tracking: {
    batchSize: 10,
    flushInterval: 5000,
    maxQueueSize: 1000,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  // User properties to track
  userProperties: {
    trackEmail: true,
    trackWalletAddress: true,
    trackUsername: true,
    trackCreatedAt: true,
  },

  // GDPR/CCPR consent
  consent: {
    required: true,
    cookieDomain: config.deepLinking.host,
    cookieLifetime: 365, // days
  },

  // Screen tracking
  screens: {
    autoTrack: true,
    trackParams: true,
    excludeScreens: ['Splash', 'Onboarding'],
  },
};

export const ANALYTICS_EVENTS = {
  // App lifecycle
  APP_OPEN: 'app_open',
  APP_CLOSE: 'app_close',
  APP_BACKGROUND: 'app_background',
  APP_FOREGROUND: 'app_foreground',

  // Authentication
  LOGIN_START: 'auth_login_start',
  LOGIN_SUCCESS: 'auth_login_success',
  LOGIN_FAILURE: 'auth_login_failure',
  LOGOUT: 'auth_logout',
  REGISTER_START: 'auth_register_start',
  REGISTER_SUCCESS: 'auth_register_success',
  REGISTER_FAILURE: 'auth_register_failure',
  WALLET_CONNECT: 'auth_wallet_connect',
  WALLET_DISCONNECT: 'auth_wallet_disconnect',
  WALLET_IMPORT: 'auth_wallet_import',
  WALLET_CREATE: 'auth_wallet_create',

  // Navigation
  SCREEN_VIEW: 'screen_view',
  NAVIGATE: 'navigate',

  // NFT actions
  NFT_VIEW: 'nft_view',
  NFT_LIST: 'nft_list',
  NFT_CREATE: 'nft_create',
  NFT_MINT: 'nft_mint',
  NFT_MINT_SUCCESS: 'nft_mint_success',
  NFT_MINT_FAILURE: 'nft_mint_failure',
  NFT_BUY: 'nft_buy',
  NFT_BUY_SUCCESS: 'nft_buy_success',
  NFT_BUY_FAILURE: 'nft_buy_failure',
  NFT_LISTING: 'nft_listing',
  NFT_UNLIST: 'nft_unlist',

  // Collection actions
  COLLECTION_VIEW: 'collection_view',
  COLLECTION_CREATE: 'collection_create',
  COLLECTION_UPDATE: 'collection_update',
  COLLECTION_DELETE: 'collection_delete',

  // Home discovery (category chips, trending carousel, new drops)
  DISCOVERY_CATEGORY_SELECT: 'discovery_category_select',
  DISCOVERY_TRENDING_IMPRESSION: 'discovery_trending_impression',
  DISCOVERY_TRENDING_ITEM_CLICK: 'discovery_trending_item_click',
  DISCOVERY_NEW_DROPS_IMPRESSION: 'discovery_new_drops_impression',
  DISCOVERY_NEW_DROPS_ITEM_CLICK: 'discovery_new_drops_item_click',

  // Auction actions
  AUCTION_VIEW: 'auction_view',
  AUCTION_CREATE: 'auction_create',
  AUCTION_BID: 'auction_bid',
  AUCTION_BID_SUCCESS: 'auction_bid_success',
  AUCTION_BID_FAILURE: 'auction_bid_failure',
  AUCTION_WATCH: 'auction_watch',
  AUCTION_UNWATCH: 'auction_unwatch',

  // Search
  SEARCH: 'search',
  SEARCH_RESULTS: 'search_results',
  SEARCH_FILTER: 'search_filter',

  // Social
  FOLLOW: 'follow',
  UNFOLLOW: 'unfollow',
  LIKE: 'like',
  UNLIKE: 'unlike',
  SHARE: 'share',
  SHARE_INITIATED: 'share_initiated',
  SHARE_COMPLETED: 'share_completed',
  SHARE_CANCELLED: 'share_cancelled',
  SHARE_FAILED: 'share_failed',

  // Wallet
  WALLET_BALANCE_CHECK: 'wallet_balance_check',
  WALLET_SEND: 'wallet_send',
  WALLET_SEND_SUCCESS: 'wallet_send_success',
  WALLET_SEND_FAILURE: 'wallet_send_failure',
  WALLET_RECEIVE: 'wallet_receive',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  ERROR_BOUNDARY: 'error_boundary',
  API_ERROR: 'api_error',

  // Performance
  PERFORMANCE_METRIC: 'performance_metric',
  SCREEN_LOAD_TIME: 'screen_load_time',
  API_RESPONSE_TIME: 'api_response_time',
  RENDER_TIME: 'render_time',

  // Offline
  OFFLINE_MODE: 'offline_mode',
  ONLINE_MODE: 'online_mode',
  OFFLINE_QUEUE_PROCESS: 'offline_queue_process',

  // Push notifications
  PUSH_RECEIVED: 'push_received',
  PUSH_OPENED: 'push_opened',
  PUSH_PERMISSION: 'push_permission',

  // Conversion funnel
  FUNNEL_START: 'funnel_start',
  FUNNEL_STEP: 'funnel_step',
  FUNNEL_COMPLETE: 'funnel_complete',
  FUNNEL_ABANDON: 'funnel_abandon',

  // Session
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  SESSION_DURATION: 'session_duration',
};

export const FUNNELS = {
  NFT_MINT: {
    id: 'nft_mint_funnel',
    steps: [
      'open_mint_screen',
      'upload_image',
      'fill_details',
      'set_price',
      'confirm_mint',
      'mint_success',
    ],
  },
  NFT_PURCHASE: {
    id: 'nft_purchase_funnel',
    steps: [
      'view_nft',
      'click_buy',
      'confirm_purchase',
      'purchase_success',
    ],
  },
  AUCTION_BID: {
    id: 'auction_bid_funnel',
    steps: [
      'view_auction',
      'enter_bid_amount',
      'confirm_bid',
      'bid_success',
    ],
  },
  WALLET_CREATE: {
    id: 'wallet_create_funnel',
    steps: [
      'open_wallet_create',
      'enter_wallet_name',
      'set_password',
      'confirm_phrase',
      'create_success',
    ],
  },
};