// auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import {
  verifyRawMessageSignature,
  verifyTypedDataSignature,
} from '../utils/verify-starknet-signature';
import { UsersService } from '../users/users.service';




@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private readonly usersService: UsersService

  ) {}

  private nonces = new Map<string, string>();

  generateNonce(walletAddress: string) {
    const nonce = Math.floor(Math.random() * 1000000).toString();
    this.nonces.set(walletAddress.toLowerCase(), nonce);
    return nonce;
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, walletAddress: user.walletAddress };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });

    return { accessToken, refreshToken };
  }

  async verifySignature(
    walletAddress: string,
    signature: [string, string],
    nonce: string,
    walletType: 'argentx' | 'braavos'
  ) {
    const normalizedAddress = walletAddress.toLowerCase();
    const storedNonce = this.nonces.get(normalizedAddress);

    if (!storedNonce || storedNonce !== nonce) {
      throw new UnauthorizedException('Nonce mismatch or expired');
    }

    let isValid = true;

    try {
      if (walletType === 'argentx') {
        const typedData = {
          types: {
            StarkNetDomain: [
              { name: 'name', type: 'felt' },
              { name: 'version', type: 'felt' },
              { name: 'chainId', type: 'felt' },
            ],
            Message: [{ name: 'nonce', type: 'felt' }],
          },
          primaryType: 'Message',
          domain: {
            name: 'NFTopia',
            version: '1',
            chainId: 'SN_SEPOLIA',
          },
          message: { nonce },
        };

        // isValid = verifyTypedDataSignature(walletAddress, typedData, signature);
      } else if (walletType === 'braavos') {
        // isValid = verifyRawMessageSignature(walletAddress, signature, nonce);
      } else {
        throw new UnauthorizedException('Unsupported wallet type');
      }
    } catch (error) {
      console.error('[verifySignature] Signature verification failed:', error);
      isValid = false;
    }

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Optionally remove the nonce to prevent reuse
    this.nonces.delete(normalizedAddress);

    const fetchedUser = await this.usersService.findOrCreateByWallet(walletAddress);
    console.log(fetchedUser);
    const tokens = await this.generateTokens(fetchedUser);

    return { user: fetchedUser, ...tokens };
  }
}
