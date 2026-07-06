import { NFT, NFTPaginationResponse, NFTQueryParams } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class NFTService {
  private static instance: NFTService;
  private constructor() {}

  static getInstance(): NFTService {
    if (!NFTService.instance) {
      NFTService.instance = new NFTService();
    }
    return NFTService.instance;
  }

  /**
   * Fetch NFTs owned by a user with pagination
   */
  async getOwnerNFTs(params: NFTQueryParams): Promise<NFTPaginationResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('ownerId', params.ownerId);
    queryParams.append('page', String(params.page || 1));
    queryParams.append('limit', String(Math.min(params.limit || 20, 100)));

    if (params.search) {
      queryParams.append('search', params.search);
    }
    if (params.collectionId) {
      queryParams.append('collectionId', params.collectionId);
    }
    if (params.includeBurned !== undefined) {
      queryParams.append('includeBurned', String(params.includeBurned));
    }

    const url = `${API_BASE_URL}/nfts?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if needed
        ...(typeof window !== 'undefined' && localStorage.getItem('token')
          ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
          : {}),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch NFTs: ${response.status}`);
    }

    const data = await response.json();
    return {
      items: data.items || data.data || [],
      total: data.total || 0,
      page: data.page || params.page || 1,
      limit: data.limit || params.limit || 20,
      hasNextPage: data.hasNextPage || false,
    };
  }

  /**
   * Get a single NFT by ID
   */
  async getNFT(id: string): Promise<NFT | null> {
    const response = await fetch(`${API_BASE_URL}/nfts/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && localStorage.getItem('token')
          ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
          : {}),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch NFT: ${response.status}`);
    }

    return response.json();
  }
}

export const nftService = NFTService.getInstance();