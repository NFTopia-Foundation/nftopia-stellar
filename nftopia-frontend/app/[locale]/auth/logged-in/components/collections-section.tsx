import { Plus, Grid3X3 } from "lucide-react"
type Collection = {
  id: string | number
  name: string
  description: string
  nftCount: number
  floorPrice: number
  totalVolume: number
  createdAt: string | number | Date
}
import { CollectionCard } from "./collection-card"
import { CollectionCardSkeleton } from "./skelletons/collection-card-skeleton"

type CollectionsSectionProps = {
  collections: Collection[]
  isLoading: boolean
}

export const CollectionsSection = ({ collections, isLoading }: CollectionsSectionProps) => (
  <div className="rounded-lg border border-purple-900">
    <div className="p-6 border-b border-purple-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">My Collections</h2>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
      </div>
    </div>

    <div className="p-6">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <CollectionCardSkeleton key={i} />
          ))}
        </div>
      ) : collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Grid3X3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No collections yet</h3>
          <p className="text-gray-600 mb-6">Create your first collection to get started</p>
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Create Collection
          </button>
        </div>
      )}
    </div>
  </div>
)
