"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { NFT } from '@/types';

interface NFTGridProps {
  nfts: NFT[];
  loading?: boolean;
  emptyMessage?: string;
}

export function NFTGrid({ nfts, loading = false, emptyMessage = 'No NFTs found' }: NFTGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-[#1E1A45] rounded-xl overflow-hidden border border-purple-900/30 animate-pulse">
            <div className="h-48 bg-purple-900/20" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-purple-900/20 rounded w-3/4" />
              <div className="h-4 bg-purple-900/20 rounded w-1/2" />
              <div className="flex justify-between">
                <div className="h-4 bg-purple-900/20 rounded w-1/3" />
                <div className="h-4 bg-purple-900/20 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="text-center py-20 bg-[#1E1A45] rounded-2xl border border-purple-900/30">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-purple-900/20 rounded-full">
            <Image
              src="/images/fallbacks/nft-fallback.svg"
              alt="No NFTs"
              width={64}
              height={64}
              className="opacity-50"
            />
          </div>
        </div>
        <h3 className="text-xl text-gray-300 font-semibold mb-2">{emptyMessage}</h3>
        <p className="text-gray-400 text-sm">You haven&apos;t minted any NFTs yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {nfts.map((nft) => (
        <Link
          key={nft.id}
          href={`/marketplace/${nft.id}`}
          className="group bg-[#1E1A45] rounded-xl overflow-hidden border border-purple-900/30 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1 hover:border-purple-500/50"
        >
          <div className="relative h-48 bg-purple-900/10 overflow-hidden">
            {nft.image ? (
              <Image
                src={nft.image}
                alt={nft.name || 'NFT'}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/fallbacks/nft-fallback.svg';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
                <Image
                  src="/images/fallbacks/nft-fallback.svg"
                  alt="NFT placeholder"
                  width={80}
                  height={80}
                  className="opacity-50"
                />
              </div>
            )}
            {nft.collectionName && (
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                {nft.collectionName}
              </div>
            )}
            {nft.lastPrice && (
              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                {nft.lastPrice} XLM
              </div>
            )}
          </div>

          <div className="p-4 space-y-2">
            <h3 className="text-white font-semibold truncate group-hover:text-purple-300 transition-colors">
              {nft.name || 'Untitled NFT'}
            </h3>
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>Token #{nft.tokenId}</span>
              <span className="text-xs text-gray-500">
                {new Date(nft.mintedAt).toLocaleDateString()}
              </span>
            </div>
            {nft.attributes && nft.attributes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {nft.attributes.slice(0, 3).map((attr, index) => (
                  <span
                    key={index}
                    className="text-xs bg-purple-900/20 text-purple-300 px-2 py-0.5 rounded-full"
                  >
                    {attr.traitType}: {attr.value}
                  </span>
                ))}
                {nft.attributes.length > 3 && (
                  <span className="text-xs text-gray-500">+{nft.attributes.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}