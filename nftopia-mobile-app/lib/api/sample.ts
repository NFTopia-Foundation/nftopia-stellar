import { config } from '@/src/config';
import {
  NFT,
  Collection,
  DashboardStats,
  ActivityEvent,
  Transaction,
  Notification,
  NotificationPreferences,
  MintFormData,
  SearchResult,
  SearchFilters,
  CreatorProfile,
  Auction,
  Bid,
  AuctionFormData,
} from '@/types';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async submitModerationReport(payload: {
    targetType: 'nft' | 'collection' | 'profile';
    targetId: string;
    reason: string;
    details?: string;
  }): Promise<void> {
    await this.request('/moderation/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Dashboard API
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/creator/dashboard/stats');
  }

  async getActivityFeed(page: number = 1, limit: number = 20): Promise<ActivityEvent[]> {
    return this.request<ActivityEvent[]>(`/creator/activity?page=${page}&limit=${limit}`);
  }

  // NFT API
  async getMyNFTs(page: number = 1, limit: number = 20): Promise<NFT[]> {
    return this.request<NFT[]>(`/nfts/mine?page=${page}&limit=${limit}`);
  }

  async getNFTById(id: string): Promise<NFT> {
    return this.request<NFT>(`/nfts/${id}`);
  }

  async mintNFT(formData: MintFormData): Promise<NFT> {
    const form = new FormData();
    form.append('name', formData.name);
    form.append('description', formData.description);
    form.append('price', formData.price);
    form.append('currency', formData.currency);
    form.append('contractAddress', formData.contractAddress);
    if (formData.collectionId) {
      form.append('collectionId', formData.collectionId);
    }
    if (formData.image) {
      const filename = formData.image.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      form.append('image', { uri: formData.image, name: filename, type } as any);
    }
    if (formData.attributes) {
      form.append('attributes', JSON.stringify(formData.attributes));
    }

    return this.request<NFT>('/nfts/mint', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // Search API
  async search(query: string, filters: SearchFilters): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query, type: filters.type });
    if (filters.category) params.append('category', filters.category);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    return this.request<SearchResult>(`/search?${params.toString()}`);
  }

  // Collection API
  async getCollections(page: number = 1, limit: number = 20, search?: string): Promise<Collection[]> {
    let endpoint = `/collections?page=${page}&limit=${limit}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    return this.request<Collection[]>(endpoint);
  }

  async getCollectionById(id: string): Promise<Collection> {
    return this.request<Collection>(`/collections/${id}`);
  }

  async getCollectionNFTs(collectionId: string, page: number = 1, limit: number = 20): Promise<NFT[]> {
    return this.request<NFT[]>(`/collections/${collectionId}/nfts?page=${page}&limit=${limit}`);
  }

  async getMyCollections(page: number = 1, limit: number = 20): Promise<Collection[]> {
    return this.request<Collection[]>(`/collections/mine?page=${page}&limit=${limit}`);
  }

  async createCollection(data: { name: string; description: string; image?: string; banner?: string }): Promise<Collection> {
    const form = new FormData();
    form.append('name', data.name);
    form.append('description', data.description);
    if (data.image) {
      const filename = data.image.split('/').pop() || 'collection.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      form.append('image', { uri: data.image, name: filename, type } as any);
    }
    if (data.banner) {
      const filename = data.banner.split('/').pop() || 'banner.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      form.append('banner', { uri: data.banner, name: filename, type } as any);
    }

    return this.request<Collection>('/collections', {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async updateCollection(id: string, data: Partial<Collection>): Promise<Collection> {
    return this.request<Collection>(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCollection(id: string): Promise<void> {
    await this.request(`/collections/${id}`, { method: 'DELETE' });
  }

  async likeCollection(id: string): Promise<void> {
    await this.request(`/collections/${id}/like`, { method: 'POST' });
  }

  async unlikeCollection(id: string): Promise<void> {
    await this.request(`/collections/${id}/like`, { method: 'DELETE' });
  }

  // Creator Profile API
  async getCreatorProfile(userId: string): Promise<CreatorProfile> {
    return this.request<CreatorProfile>(`/users/${userId}/profile`);
  }

  async getCreatorNFTs(userId: string, page: number = 1, limit: number = 20): Promise<NFT[]> {
    return this.request<NFT[]>(`/users/${userId}/nfts?page=${page}&limit=${limit}`);
  }

  async getCreatorCollections(userId: string, page: number = 1, limit: number = 20): Promise<Collection[]> {
    return this.request<Collection[]>(`/users/${userId}/collections?page=${page}&limit=${limit}`);
  }

  async getCreatorActivity(userId: string, page: number = 1, limit: number = 20): Promise<ActivityEvent[]> {
    return this.request<ActivityEvent[]>(`/users/${userId}/activity?page=${page}&limit=${limit}`);
  }

  async followUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}/follow`, { method: 'POST' });
  }

  async unfollowUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}/follow`, { method: 'DELETE' });
  }

  async updateProfile(data: Partial<CreatorProfile>): Promise<CreatorProfile> {
    return this.request<CreatorProfile>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Auction API
  async getAuctions(page: number = 1, limit: number = 20, filters?: any): Promise<Auction[]> {
    let endpoint = `/auctions?page=${page}&limit=${limit}`;
    if (filters?.category) endpoint += `&category=${filters.category}`;
    if (filters?.minPrice) endpoint += `&minPrice=${filters.minPrice}`;
    if (filters?.maxPrice) endpoint += `&maxPrice=${filters.maxPrice}`;
    if (filters?.status) endpoint += `&status=${filters.status}`;
    return this.request<Auction[]>(endpoint);
  }

  async getAuctionById(id: string): Promise<Auction> {
    return this.request<Auction>(`/auctions/${id}`);
  }

  async createAuction(data: AuctionFormData): Promise<Auction> {
    return this.request<Auction>('/auctions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async placeBid(auctionId: string, amount: string): Promise<Bid> {
    return this.request<Bid>(`/auctions/${auctionId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getBidHistory(auctionId: string): Promise<Bid[]> {
    return this.request<Bid[]>(`/auctions/${auctionId}/bids`);
  }

  async watchAuction(auctionId: string): Promise<void> {
    await this.request(`/auctions/${auctionId}/watch`, { method: 'POST' });
  }

  async unwatchAuction(auctionId: string): Promise<void> {
    await this.request(`/auctions/${auctionId}/watch`, { method: 'DELETE' });
  }

  // Earnings & Transactions API
  async getEarnings(): Promise<{ totalEarnings: string; pendingEarnings: string; totalSales: number }> {
    return this.request('/creator/earnings');
  }

  async getTransactions(page: number = 1, limit: number = 20): Promise<Transaction[]> {
    return this.request<Transaction[]>(`/creator/transactions?page=${page}&limit=${limit}`);
  }

  // Notifications API
  async getNotifications(page: number = 1, limit: number = 20): Promise<Notification[]> {
    return this.request<Notification[]>(`/notifications?page=${page}&limit=${limit}`);
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/notifications/unread/count');
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/notifications/read-all', { method: 'PUT' });
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/notifications/preferences');
  }

  async updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  }

  // Push Notification Token
  async registerPushToken(token: string): Promise<void> {
    await this.request('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // Telemetry
  async trackEvent(event: string, properties?: Record<string, any>): Promise<void> {
    try {
      await this.request('/telemetry/track', {
        method: 'POST',
        body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
      });
    } catch {
      // Silently fail telemetry
    }
  }
}

// Use config for API base URL and timeout
export const apiClient = new ApiClient(config.api.baseUrl, config.api.timeout);
export default apiClient;
