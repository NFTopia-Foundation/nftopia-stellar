// import { MarketplaceHero } from "@/components/marketplace-hero";
import { CircuitBackground } from "@/components/circuit-background";
import { LiveAuctions } from "@/components/live-auctions";
import { TopSellers } from "@/components/top-sellers";
import { TodaysPicks } from "@/components/todays-picks";
import PopularCollection from "@/components/PopularCollection";
// import { CreateAndSell } from "@/components/create-and-sell";

export default function MarketplacePage() {
  return (
    <main className="min-h-[100svh] relative text-white overflow-hidden contain-layout">
      {/* Background */}
      <CircuitBackground />

      {/* Main Content */}
      <div className="relative z-10 max-w-screen-xl mx-auto px-2 sm:px-4 md:px-8 lg:px-12 pt-12 space-y-16">
        {/* <MarketplaceHero /> */}
        <LiveAuctions />
        <TopSellers />
        <TodaysPicks />
        <PopularCollection />
        {/* <CreateAndSell /> */}
      </div>
    </main>
  );
}
