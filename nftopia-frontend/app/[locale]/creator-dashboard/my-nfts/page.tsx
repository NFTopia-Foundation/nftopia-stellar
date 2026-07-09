"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useWalletStore } from '@/lib/stores/walletStore';
import { nftService } from '@/lib/services/nft.service';
import { NFTGrid } from '@/components/nft/NFTGrid';
import { NFT, NFTPaginationResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ITEMS_PER_PAGE = 20;

export default function MyNFTsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  
  // Use correct wallet store properties
  const { 
    address, 
    connected, 
    user, 
    setConnecting, 
    setError: setWalletError 
  } = useWalletStore();
  
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Get userId from user object or wallet address
  const userId = user?.id || address;

  const fetchNFTs = useCallback(async (page: number, search?: string) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        ownerId: userId,
        page,
        limit: ITEMS_PER_PAGE,
        ...(search ? { search } : {}),
      };

      const response: NFTPaginationResponse = await nftService.getOwnerNFTs(params);
      
      setNfts(response.items);
      setTotalItems(response.total);
      setHasNextPage(response.hasNextPage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch NFTs';
      setError(errorMessage);
      setNfts([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [userId]);

  // Initial fetch and page changes
  useEffect(() => {
    if (userId) {
      fetchNFTs(currentPage, searchQuery || undefined);
    }
  }, [userId, currentPage, fetchNFTs]);

  // Handle search with debounce
  useEffect(() => {
    if (!userId) return;

    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        setIsSearching(true);
        setCurrentPage(1);
        fetchNFTs(1, searchQuery);
      } else {
        setCurrentPage(1);
        fetchNFTs(1);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, userId, fetchNFTs]);

  const handleRetry = () => {
    fetchNFTs(currentPage, searchQuery || undefined);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
    fetchNFTs(1);
  };

  // If not connected, show connect wallet prompt
  if (!connected || !userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center">
        <div className="p-6 bg-[#1E1A45] rounded-2xl border border-purple-900/30">
          <h2 className="text-2xl font-bold text-white mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-gray-400 mb-6">
            Connect your wallet to view your NFT collection
          </p>
          <Button
            onClick={() => setConnecting(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My NFTs</h1>
          <p className="text-gray-400 text-sm mt-1">
            {totalItems > 0 ? `Showing ${nfts.length} of ${totalItems} NFTs` : 'No NFTs in your collection'}
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search NFTs..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-8 py-2 bg-[#1E1A45] border border-purple-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
          {isSearching && (
            <div className="text-sm text-purple-400 animate-pulse">Searching...</div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-10 bg-[#1E1A45] rounded-xl border border-red-900/30">
          <p className="text-red-400 mb-4">{error}</p>
          <Button
            onClick={handleRetry}
            variant="outline"
            className="border-red-900/30 hover:bg-red-900/20 text-red-300"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* NFT Grid */}
      <NFTGrid
        nfts={nfts}
        loading={loading}
        emptyMessage="No NFTs found"
      />

      {/* Pagination */}
      {!loading && !error && totalItems > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-purple-900/20">
          <div className="text-sm text-gray-400">
            Page {currentPage} of {Math.ceil(totalItems / ITEMS_PER_PAGE)}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              variant="outline"
              className="border-purple-900/30 hover:bg-purple-900/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              onClick={handleNextPage}
              disabled={!hasNextPage}
              variant="outline"
              className="border-purple-900/30 hover:bg-purple-900/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}