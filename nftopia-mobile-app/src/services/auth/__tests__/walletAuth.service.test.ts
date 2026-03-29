import { Keypair } from 'stellar-sdk';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('mockedhash'),
}));

jest.mock('stellar-hd-wallet', () => {
  const { Keypair: KP } = require('stellar-sdk');
  const mockKeypair = KP.random();
  return {
    __esModule: true,
    default: {
      fromMnemonic: jest.fn().mockReturnValue({
        getKeypair: jest.fn().mockReturnValue(mockKeypair),
      }),
    },
  };
});

import { WalletAuthService } from '../walletAuth.service';
import { StellarWalletService } from '../../stellar/wallet.service';
import { AuthError, AuthErrorCode, AuthResponse, ChallengeResponse, LinkWalletResponse } from '../types';
import { Wallet } from '../../stellar/types';
import * as SecureStore from 'expo-secure-store';

const VALID_KEYPAIR = Keypair.random();
const MOCK_WALLET: Wallet = {
  publicKey: VALID_KEYPAIR.publicKey(),
  secretKey: VALID_KEYPAIR.secret(),
};

const MOCK_CHALLENGE: ChallengeResponse = {
  sessionId: 'session-abc123',
  walletAddress: MOCK_WALLET.publicKey,
  nonce: 'nonce-xyz789',
  message: 'Sign this message to authenticate: nonce-xyz789',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
};

const MOCK_AUTH_RESPONSE: AuthResponse = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  user: {
    id: 'user-001',
    walletAddress: MOCK_WALLET.publicKey,
    walletProvider: 'freighter',
  },
};

const MOCK_LINK_RESPONSE: LinkWalletResponse = {
  success: true,
  wallet: {
    id: 'wallet-001',
    userId: 'user-001',
    walletAddress: MOCK_WALLET.publicKey,
    isPrimary: false,
  },
};

function makeMockWalletService(): jest.Mocked<StellarWalletService> {
  return {
    signMessage: jest.fn().mockResolvedValue('mock-base64-signature'),
    createWallet: jest.fn(),
    importFromSecretKey: jest.fn(),
    importFromMnemonic: jest.fn(),
    getPublicKey: jest.fn(),
    isValidSecretKey: jest.fn(),
    isValidMnemonic: jest.fn(),
  } as unknown as jest.Mocked<StellarWalletService>;
}

function mockFetchOk(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

function mockFetchError(status: number, message: string): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ message }),
  } as unknown as Response);
}

describe('WalletAuthService', () => {
  let service: WalletAuthService;
  let mockWalletService: jest.Mocked<StellarWalletService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletService = makeMockWalletService();
    service = new WalletAuthService(mockWalletService, 'http://test-api.example.com');
  });

  describe('getChallenge', () => {
    it('returns a challenge response for a valid wallet address', async () => {
      mockFetchOk(MOCK_CHALLENGE);

      const result = await service.getChallenge(MOCK_WALLET.publicKey);

      expect(result).toEqual(MOCK_CHALLENGE);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.example.com/auth/wallet/challenge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ walletAddress: MOCK_WALLET.publicKey }),
        }),
      );
    });

    it('throws AuthError with CHALLENGE_FAILED on non-ok response', async () => {
      mockFetchError(400, 'Invalid wallet address');

      await expect(service.getChallenge('invalid')).rejects.toThrow(AuthError);
      await expect(service.getChallenge('invalid')).rejects.toMatchObject({
        code: AuthErrorCode.CHALLENGE_FAILED,
      });
    });

    it('throws AuthError with NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));

      await expect(service.getChallenge(MOCK_WALLET.publicKey)).rejects.toMatchObject({
        code: AuthErrorCode.NETWORK_ERROR,
      });
    });
  });

  describe('authenticate', () => {
    it('returns auth response and stores tokens on success', async () => {
      mockFetchOk(MOCK_AUTH_RESPONSE);

      const result = await service.authenticate(
        MOCK_WALLET.publicKey,
        'mock-signature',
        'mock-nonce',
      );

      expect(result).toEqual(MOCK_AUTH_RESPONSE);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nftopia_access_token',
        'mock-access-token',
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nftopia_refresh_token',
        'mock-refresh-token',
      );
    });

    it('sends correct request body to verify endpoint', async () => {
      mockFetchOk(MOCK_AUTH_RESPONSE);

      await service.authenticate(MOCK_WALLET.publicKey, 'sig-abc', 'nonce-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.example.com/auth/wallet/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            walletAddress: MOCK_WALLET.publicKey,
            signature: 'sig-abc',
            nonce: 'nonce-123',
          }),
        }),
      );
    });

    it('throws AuthError with INVALID_SIGNATURE on 401 response', async () => {
      mockFetchError(401, 'Invalid wallet signature');

      await expect(
        service.authenticate(MOCK_WALLET.publicKey, 'bad-sig', 'nonce-123'),
      ).rejects.toMatchObject({ code: AuthErrorCode.INVALID_SIGNATURE });
    });

    it('throws AuthError with AUTHENTICATION_FAILED on non-401 error response', async () => {
      mockFetchError(500, 'Internal server error');

      await expect(
        service.authenticate(MOCK_WALLET.publicKey, 'sig', 'nonce'),
      ).rejects.toMatchObject({ code: AuthErrorCode.AUTHENTICATION_FAILED });
    });

    it('throws AuthError with NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.authenticate(MOCK_WALLET.publicKey, 'sig', 'nonce'),
      ).rejects.toMatchObject({ code: AuthErrorCode.NETWORK_ERROR });
    });
  });

  describe('walletLogin', () => {
    it('completes full login flow: challenge → sign → authenticate', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(MOCK_CHALLENGE),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(MOCK_AUTH_RESPONSE),
        } as unknown as Response);

      const result = await service.walletLogin(MOCK_WALLET);

      expect(result).toEqual(MOCK_AUTH_RESPONSE);
      expect(mockWalletService.signMessage).toHaveBeenCalledWith(
        MOCK_CHALLENGE.message,
        MOCK_WALLET.secretKey,
      );
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('stores tokens after successful login', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(MOCK_CHALLENGE),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(MOCK_AUTH_RESPONSE),
        } as unknown as Response);

      await service.walletLogin(MOCK_WALLET);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nftopia_access_token',
        MOCK_AUTH_RESPONSE.access_token,
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nftopia_refresh_token',
        MOCK_AUTH_RESPONSE.refresh_token,
      );
    });

    it('propagates AuthError if challenge fails', async () => {
      mockFetchError(400, 'Invalid wallet address');

      await expect(service.walletLogin(MOCK_WALLET)).rejects.toMatchObject({
        code: AuthErrorCode.CHALLENGE_FAILED,
      });
      expect(mockWalletService.signMessage).not.toHaveBeenCalled();
    });

    it('propagates AuthError if authentication fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(MOCK_CHALLENGE),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValue({ message: 'Invalid signature' }),
        } as unknown as Response);

      await expect(service.walletLogin(MOCK_WALLET)).rejects.toMatchObject({
        code: AuthErrorCode.INVALID_SIGNATURE,
      });
    });
  });

  describe('linkWallet', () => {
    it('links wallet and returns link response on success', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-access-token');
      mockFetchOk(MOCK_LINK_RESPONSE);

      const result = await service.linkWallet(
        MOCK_WALLET.publicKey,
        'mock-signature',
        'mock-nonce',
      );

      expect(result).toEqual(MOCK_LINK_RESPONSE);
    });

    it('sends Authorization header with stored access token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('my-jwt-token');
      mockFetchOk(MOCK_LINK_RESPONSE);

      await service.linkWallet(MOCK_WALLET.publicKey, 'sig', 'nonce');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.example.com/auth/wallet/link',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        }),
      );
    });

    it('sends request without Authorization header when no token is stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      mockFetchOk(MOCK_LINK_RESPONSE);

      await service.linkWallet(MOCK_WALLET.publicKey, 'sig', 'nonce');

      const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>;
      expect(callHeaders['Authorization']).toBeUndefined();
    });

    it('throws AuthError with LINK_FAILED on non-ok response', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
      mockFetchError(409, 'Wallet already linked to another account');

      await expect(
        service.linkWallet(MOCK_WALLET.publicKey, 'sig', 'nonce'),
      ).rejects.toMatchObject({ code: AuthErrorCode.LINK_FAILED });
    });

    it('throws AuthError with NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(
        service.linkWallet(MOCK_WALLET.publicKey, 'sig', 'nonce'),
      ).rejects.toMatchObject({ code: AuthErrorCode.NETWORK_ERROR });
    });
  });

  describe('unlinkWallet', () => {
    it('resolves without error on success', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      } as unknown as Response);

      await expect(service.unlinkWallet(MOCK_WALLET.publicKey)).resolves.toBeUndefined();
    });

    it('sends DELETE request to unlink endpoint with wallet address', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('my-jwt-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      } as unknown as Response);

      await service.unlinkWallet(MOCK_WALLET.publicKey);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-api.example.com/auth/wallet/unlink',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ walletAddress: MOCK_WALLET.publicKey }),
        }),
      );
    });

    it('sends Authorization header with stored access token', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('my-jwt-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      } as unknown as Response);

      await service.unlinkWallet(MOCK_WALLET.publicKey);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        }),
      );
    });

    it('throws AuthError with UNLINK_FAILED on non-ok response', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token');
      mockFetchError(404, 'Wallet not linked to this account');

      await expect(service.unlinkWallet(MOCK_WALLET.publicKey)).rejects.toMatchObject({
        code: AuthErrorCode.UNLINK_FAILED,
      });
    });

    it('throws AuthError with NETWORK_ERROR on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

      await expect(service.unlinkWallet(MOCK_WALLET.publicKey)).rejects.toMatchObject({
        code: AuthErrorCode.NETWORK_ERROR,
      });
    });
  });

  describe('AuthError', () => {
    it('has correct name and code properties', () => {
      const err = new AuthError('Something failed', AuthErrorCode.AUTHENTICATION_FAILED);
      expect(err.name).toBe('AuthError');
      expect(err.code).toBe(AuthErrorCode.AUTHENTICATION_FAILED);
      expect(err.message).toBe('Something failed');
      expect(err instanceof Error).toBe(true);
    });
  });
});
