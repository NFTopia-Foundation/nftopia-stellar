import * as LocalAuthentication from 'expo-local-authentication';
import { Wallet } from '../stellar/types';
import { StellarWalletService } from '../stellar/wallet.service';
import { tokenStorage } from './tokenStorage';
import {
  AuthError,
  AuthErrorCode,
  AuthResponse,
  ChallengeResponse,
  LinkWalletResponse,
} from './types';

export class WalletAuthService {
  private readonly walletService: StellarWalletService;
  private readonly baseUrl: string;

  constructor(walletService?: StellarWalletService, baseUrl?: string) {
    this.walletService = walletService ?? new StellarWalletService();
    this.baseUrl = baseUrl ?? 'http://localhost:3000';
  }

  async getChallenge(walletAddress: string): Promise<ChallengeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/wallet/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Challenge request failed with status ${response.status}`,
          AuthErrorCode.CHALLENGE_FAILED,
        );
      }

      return response.json() as Promise<ChallengeResponse>;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to get challenge: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async authenticate(
    walletAddress: string,
    signature: string,
    nonce: string,
  ): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/wallet/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature, nonce }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        const message =
          error.message ?? `Authentication failed with status ${response.status}`;
        const code =
          response.status === 401
            ? AuthErrorCode.INVALID_SIGNATURE
            : AuthErrorCode.AUTHENTICATION_FAILED;
        throw new AuthError(message, code);
      }

      const authResponse = (await response.json()) as AuthResponse;
      await tokenStorage.saveTokens(authResponse.access_token, authResponse.refresh_token);
      return authResponse;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to authenticate: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async walletLogin(wallet: Wallet): Promise<AuthResponse> {
    const challenge = await this.getChallenge(wallet.publicKey);
    const signature = await this.walletService.signMessage(
      challenge.message,
      wallet.secretKey,
    );
    return this.authenticate(wallet.publicKey, signature, challenge.nonce);
  }

  async linkWallet(
    walletAddress: string,
    signature: string,
    nonce: string,
  ): Promise<LinkWalletResponse> {
    try {
      const accessToken = await tokenStorage.getAccessToken();
      const response = await fetch(`${this.baseUrl}/auth/wallet/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ walletAddress, signature, nonce }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Wallet link failed with status ${response.status}`,
          AuthErrorCode.LINK_FAILED,
        );
      }

      return response.json() as Promise<LinkWalletResponse>;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to link wallet: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async unlinkWallet(walletAddress: string): Promise<void> {
    try {
      const accessToken = await tokenStorage.getAccessToken();
      const response = await fetch(`${this.baseUrl}/auth/wallet/unlink`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Wallet unlink failed with status ${response.status}`,
          AuthErrorCode.UNLINK_FAILED,
        );
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to unlink wallet: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async requireBiometricReauth(promptMessage?: string): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return true;
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage ?? 'Authenticate to access wallet keys',
        fallbackLabel: 'Use passcode',
      });
      return result.success;
    } catch {
      return false;
    }
  }

  async revealSecretKey(publicKey: string, wallet: Wallet): Promise<string | null> {
    const authenticated = await this.requireBiometricReauth(
      'Authenticate to reveal secret key',
    );
    if (!authenticated) return null;
    return wallet.secretKey;
  }

  async revealMnemonic(wallet: Wallet): Promise<string | null> {
    if (!wallet.mnemonic) return null;
    const authenticated = await this.requireBiometricReauth(
      'Authenticate to reveal recovery phrase',
    );
    if (!authenticated) return null;
    return wallet.mnemonic;
  }
}
