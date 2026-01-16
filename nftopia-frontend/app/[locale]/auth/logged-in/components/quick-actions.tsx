import { Plus, TrendingUp, Grid3X3, Users } from "lucide-react"

export const QuickActions = () => (
  <div className="rounded-lg border border-nftopia-border bg-nftopia-card p-6">
    <h2 className="text-lg font-semibold text-nftopia-text mb-4">Quick Actions</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <button className="flex items-center gap-3 p-4 border border-dashed border-nftopia-primary rounded-lg hover:border-nftopia-hover hover:bg-nftopia-hover transition-colors">
        <Plus className="w-5 h-5 text-nftopia-primary" />
        <span className="text-sm font-medium text-nftopia-subtext">Create NFT</span>
      </button>
      <button className="flex items-center gap-3 p-4 border border-dashed border-nftopia-primary rounded-lg hover:border-nftopia-hover hover:bg-nftopia-hover transition-colors">
        <Grid3X3 className="w-5 h-5 text-nftopia-primary" />
        <span className="text-sm font-medium text-nftopia-subtext">New Collection</span>
      </button>
      <button className="flex items-center gap-3 p-4 border border-dashed border-nftopia-primary rounded-lg hover:border-nftopia-hover hover:bg-nftopia-hover transition-colors">
        <TrendingUp className="w-5 h-5 text-nftopia-primary" />
        <span className="text-sm font-medium text-nftopia-subtext">Analytics</span>
      </button>
      <button className="flex items-center gap-3 p-4 border border-dashed border-nftopia-primary rounded-lg hover:border-nftopia-hover hover:bg-nftopia-hover transition-colors">
        <Users className="w-5 h-5 text-nftopia-primary" />
        <span className="text-sm font-medium text-nftopia-subtext">Community</span>
      </button>
    </div>
  </div>
)
