import type React from "react"
export type StatCardProps = {
  icon: React.ComponentType<any>
  label: string
  value: number
  change?: number
  isLoading?: boolean
}

export type Collection = {
  id: number
  name: string
  description: string
  coverImage: string
  nftCount: number
  floorPrice: number
  totalVolume: number
  createdAt: string
}

export type CollectionCardProps = {
  collection: Collection
  isLoading?: boolean
}
