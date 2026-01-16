// src/types/RequestWithUser.ts
import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    sub: string; // User ID (UUID)
    walletAddress: string; // To identify wallet-auth users
    isArtist: boolean; // Useful to check permissions for artist-only features
    username?: string; // Optional, but convenient for personalization
  };
}
