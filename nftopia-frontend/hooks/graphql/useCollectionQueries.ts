import { QueryHookOptions, useMutation, useQuery } from "@apollo/client";
import {
  GetTopCollectionsQuery,
  GetTopCollectionsQueryVariables,
  useGetTopCollectionsQuery as useGetTopCollectionsQueryGenerated,
} from "./generated";
import { GET_TOP_COLLECTIONS_QUERY } from "@/lib/graphql/queries/collection.queries";
import { LIKE_COLLECTION_MUTATION, UNLIKE_COLLECTION_MUTATION, GET_COLLECTION_LIKES_QUERY } from "@/lib/graphql/mutations/collection.mutations";
import { useMemo, useCallback, useRef, useState } from "react";
import { Collection } from "@/types";
import { useWalletStore } from "@/stores/walletStore";
import { useToast } from "@/lib/stores";

// Enhanced hook with data transformation
export function usePopularCollectionsQuery(
  options?: QueryHookOptions<GetTopCollectionsQuery, GetTopCollectionsQueryVariables>
) {
  const result = useGetTopCollectionsQueryGenerated(options);
  
  const transformedData = useMemo(() => {
    if (!result.data?.topCollections) return { topCollections: [] };
    
    const collections: Collection[] = result.data.topCollections.map((col: any) => {
      const nftImages = col.nfts?.edges?.map((edge: any) => edge.node.image) || [];
      const likeCount = col.likes || 0;
      
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

  return {
    ...result,
    data: transformedData,
  };
}

export { useGetTopCollectionsQueryGenerated as useGetTopCollectionsQuery };

// Hook for collection likes
export function useLikeCollection(collectionId: string) {
  const { connected } = useWalletStore();
  const { showError, showSuccess, showWarning } = useToast(); // Use specific toast methods
  const [isProcessing, setIsProcessing] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Query for current like status
  const { data: likesData, refetch: refetchLikes } = useQuery(GET_COLLECTION_LIKES_QUERY, {
    variables: { collectionId },
    fetchPolicy: 'cache-first',
    skip: !collectionId,
  });

  const [likeMutation] = useMutation(LIKE_COLLECTION_MUTATION);
  const [unlikeMutation] = useMutation(UNLIKE_COLLECTION_MUTATION);

  const isLiked = likesData?.collectionLikes?.isLiked || false;
  const likesCount = likesData?.collectionLikes?.count || 0;

  const toggleLike = useCallback(async () => {
    // Check authentication using 'connected' from wallet store
    if (!connected) {
      showWarning('Please connect your wallet to like collections');
      return { success: false, message: 'Not authenticated' };
    }

    if (isProcessing) {
      return { success: false, message: 'Already processing' };
    }

    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    return new Promise<{ success: boolean; likesCount?: number; userLiked?: boolean; message?: string }>((resolve) => {
      debounceRef.current = setTimeout(async () => {
        setIsProcessing(true);
        
        try {
          let result;
          if (isLiked) {
            const { data } = await unlikeMutation({
              variables: {
                input: { collectionId },
              },
            });
            result = data?.unlikeCollection;
          } else {
            const { data } = await likeMutation({
              variables: {
                input: { collectionId },
              },
            });
            result = data?.likeCollection;
          }
          
          if (result?.success) {
            await refetchLikes();
            showSuccess(isLiked ? 'Collection unliked successfully' : 'Collection liked successfully');
            resolve({ success: true, likesCount: result.likesCount, userLiked: result.userLiked });
          } else {
            throw new Error(result?.message || 'Failed to update like status');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update like status';
          showError(errorMessage);
          resolve({ success: false, message: errorMessage });
        } finally {
          setIsProcessing(false);
          debounceRef.current = null;
        }
      }, 300);
    });
  }, [collectionId, isLiked, connected, isProcessing, likeMutation, unlikeMutation, refetchLikes, showSuccess, showError, showWarning]);

  return {
    isLiked,
    likesCount,
    isLoading: isProcessing,
    toggleLike,
    refetchLikes,
  };
}