import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { SUPPORTED_WALLET_PROVIDERS } from './wallet-challenge.dto';
import type { WalletProvider } from './wallet-challenge.dto';

export class WalletVerifyDto {
  @ApiProperty({
    example: 'GBRPYHIL2C2X7R5G6VTOJ5SZXJ7F4XFP7E2GZ4Y6I2N7E4W7J4F7G56V',
  })
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'Challenge nonce returned by /auth/wallet/challenge',
  })
  @IsString()
  @MinLength(8)
  nonce: string;

  @ApiProperty({
    description: 'Base64 encoded signature over the challenge message',
  })
  @IsBase64()
  signature: string;

  @ApiPropertyOptional({ enum: SUPPORTED_WALLET_PROVIDERS })
  @IsOptional()
  @IsIn(SUPPORTED_WALLET_PROVIDERS)
  walletProvider?: WalletProvider;
}

export class WalletLinkDto extends WalletVerifyDto {}

export class WalletUnlinkDto {
  @ApiProperty({
    example: 'GBRPYHIL2C2X7R5G6VTOJ5SZXJ7F4XFP7E2GZ4Y6I2N7E4W7J4F7G56V',
  })
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key',
  })
  walletAddress: string;
}
