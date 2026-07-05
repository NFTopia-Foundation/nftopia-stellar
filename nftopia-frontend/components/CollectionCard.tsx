"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageWithFallback } from './image';
import Link from 'next/link';
import { Heart, Loader2 } from 'lucide-react';
import { Collection } from '@/types';
import { useLikeCollection } from '@/hooks/graphql/useCollectionQueries';

interface CollectionCardProps {
  collection: Collection;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection }) => {
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(collection.likes);
  const isProcessingRef = useRef(false);

  // Use the like hook
  const { 
    isLiked: backendIsLiked, 
    likesCount: backendLikesCount,
    isLoading: backendLoading,
    toggleLike,
  } = useLikeCollection(collection.id);

  // Sync state with backend data
  useEffect(() => {
    if (backendIsLiked !== undefined) {
      setLocalIsLiked(backendIsLiked);
    }
    if (backendLikesCount !== undefined) {
      setLocalLikeCount(backendLikesCount);
    }
  }, [backendIsLiked, backendLikesCount]);

  const handleLikeClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isProcessingRef.current || backendLoading) return;

    const previousLiked = localIsLiked;
    const previousCount = localLikeCount;
    setLocalIsLiked(!localIsLiked);
    setLocalLikeCount(prev => previousLiked ? prev - 1 : prev + 1);
    isProcessingRef.current = true;

    try {
      const result = await toggleLike();
      if (!result.success) {
        // Rollback on error
        setLocalIsLiked(previousLiked);
        setLocalLikeCount(previousCount);
        if (result.message) {
          console.error(result.message);
        }
      }
    } catch (error) {
      // Rollback on error
      setLocalIsLiked(previousLiked);
      setLocalLikeCount(previousCount);
      console.error('Like action failed:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [localIsLiked, localLikeCount, toggleLike, backendLoading]);

  const isLoading = backendLoading || isProcessingRef.current;

  return (
    <Link href={`/collection/${collection.id}`} legacyBehavior>
      <a
        className="block bg-[#1a1a2e] rounded-xl p-4 group transition duration-300 ease-in-out hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0f0f1a]"
        aria-label={`View collection: ${collection.title}`}
      >
        {/* Image Grid */}
        <div className="grid grid-cols-2 grid-rows-2 gap-2 mb-4 aspect-[4/3] overflow-hidden rounded-lg">
          {/* Main Image */}
          <div className="relative col-span-1 row-span-2 bg-orange-300 group-hover:opacity-90 transition-opacity flex items-center justify-center p-2">
            <ImageWithFallback
              src={collection.images.main}
              alt={`${collection.title} main image`}
              width={400}
              height={300}
              sizes="(max-width: 768px) 80vw, (max-width: 1200px) 40vw, 25vw"
              className="transition-transform duration-300 group-hover:scale-105"
              containerClassName="w-full h-full"
              fallbackSrc="/images/fallbacks/collection-fallback.svg"
            />
          </div>
          {/* Secondary Image 1 */}
          <div className="relative col-span-1 row-span-1 bg-purple-400 group-hover:opacity-90 transition-opacity flex items-center justify-center p-1">
            <ImageWithFallback
              src={collection.images.secondary1}
              alt={`${collection.title} secondary image 1`}
              width={160}
              height={120}
              sizes="(max-width: 768px) 40vw, (max-width: 1200px) 20vw, 12vw"
              className="transition-transform duration-300 group-hover:scale-105"
              containerClassName="w-full h-full"
              fallbackSrc="/images/fallbacks/nft-fallback.svg"
            />
            {/* Like count overlay on the top-right secondary image */}
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
              <Heart size={12} fill="white" strokeWidth={0} />
              <span>{localLikeCount}</span>
            </div>
          </div>
          {/* Secondary Image 2 */}
          <div className="relative col-span-1 row-span-1 bg-cyan-400 group-hover:opacity-90 transition-opacity flex items-center justify-center p-1">
            <ImageWithFallback
              src={collection.images.secondary2}
              alt={`${collection.title} secondary image 2`}
              width={160}
              height={120}
              sizes="(max-width: 768px) 40vw, (max-width: 1200px) 20vw, 12vw"
              className="transition-transform duration-300 group-hover:scale-105"
              containerClassName="w-full h-full"
              fallbackSrc="/images/fallbacks/nft-fallback.svg"
            />
          </div>
        </div>

        {/* Card Content */}
        <div>
          <h3 className="text-white font-semibold text-lg mb-1 truncate group-hover:text-purple-300 transition-colors">
            {collection.title}
          </h3>
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-2">
              {/* Creator Avatar */}
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                <ImageWithFallback
                  src={collection.creatorImage}
                  alt={`${collection.creatorName} avatar`}
                  width={20}
                  height={20}
                  className="rounded-full"
                  fallbackSrc="/images/fallbacks/avatar-fallback.svg"
                />
              </div>
              <span className="truncate">{collection.creatorName}</span>
            </div>
            <button
              onClick={handleLikeClick}
              disabled={isLoading}
              aria-pressed={localIsLiked}
              aria-label={localIsLiked ? 'Unlike collection' : 'Like collection'}
              className={`p-1 rounded-full transition-all duration-200 z-10 ${
                isLoading 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50'
              }`}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin text-purple-400" />
              ) : (
                <Heart
                  size={18}
                  fill={localIsLiked ? 'rgb(192, 132, 252)' : 'none'}
                  stroke={localIsLiked ? 'rgb(192, 132, 252)' : 'currentColor'}
                  className={`transition-all duration-200 ${localIsLiked ? 'text-purple-400 scale-110' : 'text-gray-500'}`}
                />
              )}
            </button>
          </div>
        </div>
      </a>
    </Link>
  );
};

export default CollectionCard;