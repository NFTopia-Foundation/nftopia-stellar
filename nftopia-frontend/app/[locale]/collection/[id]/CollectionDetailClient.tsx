"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Award, ImageIcon } from "lucide-react";
import { CircuitBackground } from "@/components/circuit-background";
import { NFTGrid } from "@/components/nft/NFTGrid";
import type { NFT } from "@/types";

interface CollectionData {
  id: string;
  name: string;
  description?: string;
  image?: string;
  creatorId?: string;
  totalVolume?: string;
  floorPrice?: string;
  totalSupply?: number;
  creator?: {
    id: string;
    username?: string;
    walletAddress?: string;
    avatar?: string;
  };
  nfts?: {
    edges?: Array<{
      node: NFT;
    }>;
    totalCount?: number;
  };
}

export function CollectionDetailClient({
  collection,
  locale,
}: {
  collection: CollectionData;
  locale: string;
}) {
  const nfts: NFT[] = collection.nfts?.edges?.map((e) => e.node) || [];
  const totalCount = collection.nfts?.totalCount || nfts.length;

  return (
    <main className="min-h-screen relative text-white overflow-hidden">
      <CircuitBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/${locale}/marketplace`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Marketplace</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-1">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-900/50 border border-gray-800/50">
              {collection.image ? (
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <ImageIcon className="h-20 w-20" />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{collection.name}</h1>
              {collection.creator && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Award className="h-4 w-4 text-emerald-400" />
                  <span>
                    Created by{" "}
                    <Link
                      href={`/${locale}/creator/${collection.creator.username || collection.creator.id}`}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {collection.creator.username ||
                        `${collection.creator.walletAddress?.slice(0, 6)}...${collection.creator.walletAddress?.slice(-4)}`}
                    </Link>
                  </span>
                </div>
              )}
            </div>

            {collection.description && (
              <p className="text-gray-300 leading-relaxed">{collection.description}</p>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                <p className="text-xs text-gray-400 mb-1">Items</p>
                <p className="text-xl font-bold text-white">{totalCount}</p>
              </div>
              {collection.totalVolume && (
                <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                  <p className="text-xs text-gray-400 mb-1">Volume</p>
                  <p className="text-xl font-bold text-white">
                    {parseFloat(collection.totalVolume).toFixed(2)} XLM
                  </p>
                </div>
              )}
              {collection.floorPrice && (
                <div className="p-4 rounded-xl bg-[#1E1A45] border border-purple-900/30">
                  <p className="text-xs text-gray-400 mb-1">Floor</p>
                  <p className="text-xl font-bold text-white">
                    {parseFloat(collection.floorPrice).toFixed(2)} XLM
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-6">NFTs in this Collection</h2>
        <NFTGrid nfts={nfts} emptyMessage="No NFTs in this collection yet." />
      </div>
    </main>
  );
}
