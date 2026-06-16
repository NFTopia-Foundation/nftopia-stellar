import { Module, OnModuleInit } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TwoFactorService } from './two-factor.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/user.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { WalletSession } from './entities/wallet-session.entity';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';

const jwtAccessExpiresInSeconds = parseInt(
  process.env.JWT_EXPIRES_IN_SECONDS || '900',
  10,
);

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User, UserWallet, WalletSession]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: jwtAccessExpiresInSeconds,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TwoFactorService, StellarSignatureStrategy, JwtStrategy],
  exports: [AuthService, TwoFactorService, JwtStrategy],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  onModuleInit(): void {
    this.authService.setTwoFactorService(this.twoFactorService);
  }
}
