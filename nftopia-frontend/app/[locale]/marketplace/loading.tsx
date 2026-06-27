import { CircuitBackground } from "@/components/circuit-background";
import { MarketplaceSkeleton } from "@/components/Skeleton/MarketplaceSkeleton";

export default function MarketplaceLoading() {
  return (
    <main className="min-h-[100svh] relative text-white overflow-hidden contain-layout">
      <CircuitBackground />
      <div className="relative z-10">
        <MarketplaceSkeleton />
      </div>
    </main>
  );
}
