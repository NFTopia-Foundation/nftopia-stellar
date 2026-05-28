export const IMAGE_DEFAULTS = {
  fallback: {
    collection: '/images/fallbacks/collection-fallback.svg',
    avatar: '/images/fallbacks/avatar-fallback.svg',
    nft: '/images/fallbacks/nft-fallback.svg',
    category: '/images/fallbacks/category-fallback.svg',
  },
  blurPlaceholders: {
    collection:
      'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2211%22 height=%2211%22 viewBox=%220 0 11 11%22%3E%3Crect width=%2211%22 height=%2211%22 fill=%22%23111827%22/%3E%3C/svg%3E',
    avatar:
      'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2211%22 height=%2211%22 viewBox=%220 0 11 11%22%3E%3Crect width=%2211%22 height=%2211%22 fill=%22%233b82f6%22/%3E%3C/svg%3E',
  },
  sizes: {
    collectionCard: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
    avatar: '(max-width: 640px) 40px, 48px',
    categoryTile: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    nftCard: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
  },
  quality: {
    default: 85,
    avatar: 75,
    thumbnail: 75,
    detail: 90,
  },
};
