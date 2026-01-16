export const CollectionCardSkeleton = () => (
  <div className="rounded-lg border border-nftopia-border bg-nftopia-card overflow-hidden animate-pulse">
    <div className="w-full h-48 bg-nftopia-hover"></div>
    <div className="p-4">
      <div className="w-32 h-6 bg-nftopia-hover rounded mb-2"></div>
      <div className="w-full h-4 bg-nftopia-hover rounded mb-4"></div>
      <div className="flex justify-between items-center mb-3">
        <div className="w-16 h-4 bg-nftopia-hover rounded"></div>
        <div className="w-20 h-4 bg-nftopia-hover rounded"></div>
      </div>
      <div className="flex justify-between items-center">
        <div className="w-24 h-4 bg-nftopia-hover rounded"></div>
        <div className="w-8 h-8 bg-nftopia-hover rounded"></div>
      </div>
    </div>
  </div>
)
