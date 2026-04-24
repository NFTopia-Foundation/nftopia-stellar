export const NftCardSkeleton = () => {
    return (
        <div className="animate-pulse rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden">
            <div className="aspect-square bg-white/10" />
            <div className="p-4 space-y-3">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
                <div className="flex gap-2">
                    <div className="h-5 w-12 bg-white/10 rounded" />
                    <div className="h-5 w-12 bg-white/10 rounded" />
                </div>
            </div>
        </div>
    );
};
