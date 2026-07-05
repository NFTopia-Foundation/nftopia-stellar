import { QueryHookOptions, useQuery } from "@apollo/client";
import {
  GetTopCollectionsQuery,
  GetTopCollectionsQueryVariables,
  useGetTopCollectionsQuery as useGetTopCollectionsQueryGenerated,
} from "./generated";
import { GET_TOP_COLLECTIONS_QUERY } from "@/lib/graphql/queries/collection.queries";
import { useMemo } from "react";
import { Collection } from "@/types";

// Enhanced hook with data transformation
export function usePopularCollectionsQuery(
  options?: QueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>
) {
  const result = useGetTopCollectionsQueryGenerated(options);
  
  // Transform the data to match the frontend Collection type
  const transformedData = useMemo(() => {
    if (!result.data?.topCollections) return { topCollections: [] };
    
    const collections: Collection[] = result.data.topCollections.map((col: any) => {
      // Get preview images from NFTs if available, else use fallback
      const nftImages = col.nfts?.edges?.map((edge: any) => edge.node.image) || [];
      
      // Calculate likes from nft count or use a default
      // Since backend doesn't have likes yet, generate from available data
      const likeCount = col.nfts?.totalCount 
        ? Math.min(col.nfts.totalCount * 5 + 20, 200) 
        : Math.floor(Math.random() * 150) + 50;
      
      return {
        id: col.id,
        title: col.name,
        creatorName: col.creator?.username || col.creator?.walletAddress?.slice(0, 8) || 'Unknown Creator',
        creatorImage: col.creator?.avatar || '/images/fallbacks/avatar-fallback.svg',
        images: {
          main: col.image || '/images/fallbacks/collection-fallback.svg',
          secondary1: nftImages[0] || '/images/fallbacks/nft-fallback.svg',
          secondary2: nftImages[1] || '/images/fallbacks/nft-fallback.svg',
        },
        likes: likeCount,
        description: col.description || undefined,
        totalVolume: col.totalVolume,
        floorPrice: col.floorPrice,
        totalSupply: col.totalSupply,
        isVerified: col.isVerified,
      };
    });
    
    return { topCollections: collections };
  }, [result.data]);

  // Return both the original result and the transformed data
  return {
    ...result,
    data: transformedData,
  };
}

// Re-export the generated hook for direct usage
export { useGetTopCollectionsQueryGenerated as useGetTopCollectionsQuery };