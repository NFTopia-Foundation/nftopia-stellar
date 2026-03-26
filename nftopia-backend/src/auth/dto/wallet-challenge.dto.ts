import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

export const SUPPORTED_WALLET_PROVIDERS = [
  'freighter',
  'albedo',
  'walletconnect',
] as const;

export type WalletProvider = (typeof SUPPORTED_WALLET_PROVIDERS)[number];

export class WalletChallengeDto {
  @ApiProperty({
    description: 'Stellar public key that will sign the challenge message',
    example: 'GBRPYHIL2C2X7R5G6VTOJ5SZXJ7F4XFP7E2GZ4Y6I2N7E4W7J4F7G56V',
  })
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key',
  })
  walletAddress: string;

  @ApiPropertyOptional({
    description: 'Wallet provider used by the client',
    enum: SUPPORTED_WALLET_PROVIDERS,
  })
  @IsOptional()
  @IsIn(SUPPORTED_WALLET_PROVIDERS)
  walletProvider?: WalletProvider;
}

export class WalletChallengeResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty()
  nonce: string;

  @ApiProperty({
    description: 'Human-readable challenge message to be signed by the wallet',
  })
  message: string;

  @ApiProperty({
    description: 'UTC ISO timestamp when the challenge expires',
    example: '2026-03-25T10:40:00.000Z',
  })
  expiresAt: string;
}
