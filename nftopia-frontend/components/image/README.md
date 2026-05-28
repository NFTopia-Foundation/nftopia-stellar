OptimizedImage component

Usage

- `OptimizedImage` wraps `next/image` and provides:
  - 300ms skeleton delay to prevent flicker
  - optional `blurPlaceholder` (base64) via `placeholder='blur'`
  - `fallbackSrc` for error states
  - automatic skeleton sizing when `width`/`height` are provided
  - retry button on error with exponential backoff handled by `useImageLoadingState`

Props

- `src` (string) – image source
- `alt` (string) – alt text
- `fallbackSrc` (string) – fallback image URL
- `blurPlaceholder` (string) – base64 blurDataURL
- `skeleton` (boolean) – show skeleton (default: true)
- `width`, `height` – passed to image and skeleton for consistent sizing

Examples

```tsx
<OptimizedImage src={nft.image} alt={nft.name} width={320} height={240} fallbackSrc="/images/fallbacks/nft-fallback.svg" />
```

Testing

- Component has unit tests covering loading delay and retry behavior.

Notes

- For production LQIP, generate `blurDataURL` for frequently-used images and pass via `blurPlaceholder`.
