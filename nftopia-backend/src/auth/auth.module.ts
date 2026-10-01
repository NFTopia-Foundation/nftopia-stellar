import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';
import { StellarSignatureGuard } from './stellar-signature.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserWallet } from './entities/user-wallet.entity';
import { WalletSession } from './entities/wallet-session.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenFamily } from './entities/refresh-token-family.entity';
import { User } from '../users/user.entity';
import { TwoFactorModule } from './two-factor.module';
import { EmailModule } from '../modules/email/email.module';
import Redis from 'ioredis';
import {
  RedisWalletNonceStore,
  WALLET_NONCE_STORE,
} from './wallet-nonce.store';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'your-secret-key-change-in-production',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ||
            '1h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      UserWallet,
      WalletSession,
      RefreshToken,
      RefreshTokenFamily,
    ]),
    forwardRef(() => TwoFactorModule),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    StellarSignatureStrategy,
    StellarSignatureGuard,
    JwtAuthGuard,
    {
      // Wallet-auth nonces live in Redis so a challenge survives restarts and
      // can be completed on any backend instance (#572).
      provide: WALLET_NONCE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new RedisWalletNonceStore(
          new Redis({
            host: config.get<string>('REDIS_HOST') || 'localhost',
            port: parseInt(config.get<string>('REDIS_PORT') || '6379', 10),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            db: parseInt(config.get<string>('REDIS_DB') || '0', 10),
          }),
        ),
    },
  ],
  exports: [AuthService, JwtStrategy, StellarSignatureStrategy, JwtAuthGuard],
})
export class AuthModule {}
