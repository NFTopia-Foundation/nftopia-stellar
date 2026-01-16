"use client"

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react'; // Assuming lucide-react is installed
import { Collection } from '@/types'; // Assuming '@/*' path alias is configured for 'apps/frontend/*'

interface CollectionCardProps {
  collection: Collection;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(collection.likes);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent link navigation when clicking the heart
    e.stopPropagation(); // Prevent card click event
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    // TODO: Add API call to persist like status
    console.log(`Collection ${collection.id} like status: ${!isLiked}`);
  };

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
            {/* Replace Placeholder N Logo with SVG Image */}
            <Image
              src="/nftopia-03.svg"
              alt="NFTopia Logo"
              width={80} // Adjust size as needed
              height={80} // Adjust size as needed
              className="opacity-50"
            />
            {/* <Image
              src={collection.images.main}
              alt={`${collection.title} main image`}
              fill
              sizes="(max-width: 768px) 80vw, (max-width: 1200px) 40vw, 25vw"
              style={{ objectFit: 'cover' }}
              className="transition-transform duration-300 group-hover:scale-105"
            /> */}
          </div>
          {/* Secondary Image 1 */}
          <div className="relative col-span-1 row-span-1 bg-purple-400 group-hover:opacity-90 transition-opacity flex items-center justify-center p-1">
             {/* Replace Placeholder N Logo with SVG Image */}
             <Image
              src="/nftopia-03.svg"
              alt="NFTopia Logo"
              width={40} // Adjust size as needed
              height={40} // Adjust size as needed
              className="opacity-50"
            />
            {/* <Image
              src={collection.images.secondary1}
              alt={`${collection.title} secondary image 1`}
              fill
              sizes="(max-width: 768px) 40vw, (max-width: 1200px) 20vw, 12vw"
               style={{ objectFit: 'cover' }}
              className="transition-transform duration-300 group-hover:scale-105"
            /> */}
            {/* Like count overlay on the top-right secondary image */}
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
              <Heart size={12} fill="white" strokeWidth={0} />
              <span>{likeCount}</span>
            </div>
          </div>
          {/* Secondary Image 2 */}
          <div className="relative col-span-1 row-span-1 bg-cyan-400 group-hover:opacity-90 transition-opacity flex items-center justify-center p-1">
             {/* Replace Placeholder N Logo with SVG Image */}
             <Image
              src="/nftopia-03.svg"
              alt="NFTopia Logo"
              width={40} // Adjust size as needed
              height={40} // Adjust size as needed
              className="opacity-50"
            />
            {/* <Image
              src={collection.images.secondary2}
              alt={`${collection.title} secondary image 2`}
              fill
              sizes="(max-width: 768px) 40vw, (max-width: 1200px) 20vw, 12vw"
               style={{ objectFit: 'cover' }}
              className="transition-transform duration-300 group-hover:scale-105"
            /> */}
          </div>
        </div>

        {/* Card Content */}
        <div>
          <h3 className="text-white font-semibold text-lg mb-1 truncate group-hover:text-purple-300 transition-colors">
            {collection.title}
          </h3>
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-2">
              {/* Placeholder Creator Avatar */}
              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-xs text-white font-bold overflow-hidden flex-shrink-0">
                {collection.creatorName.charAt(0).toUpperCase()}
              </div>
              {/* <Image
                src={collection.creatorImage}
                alt={`${collection.creatorName} avatar`}
                width={20}
                height={20}
                className="rounded-full"
              /> */}
              <span className="truncate">{collection.creatorName}</span>
            </div>
            <button
              onClick={handleLikeClick}
              aria-pressed={isLiked}
              aria-label={isLiked ? 'Unlike collection' : 'Like collection'}
              className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50 transition-all duration-200 z-10"
            >
              <Heart
                size={18}
                fill={isLiked ? 'rgb(192, 132, 252)' : 'none'}
                stroke={isLiked ? 'rgb(192, 132, 252)' : 'currentColor'}
                className={`transition-all duration-200 ${isLiked ? 'text-purple-400 scale-110' : ''}`}
              />
            </button>
          </div>
        </div>
      </a>
    </Link>
  );
};

export default CollectionCard; 