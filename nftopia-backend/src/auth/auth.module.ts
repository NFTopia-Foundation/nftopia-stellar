import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailService } from './mail.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../users/user.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { WalletSession } from './entities/wallet-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { StellarSignatureStrategy } from './strategies/stellar.strategy';

const jwtAccessExpiresInSeconds = parseInt(
  process.env.JWT_EXPIRES_IN_SECONDS || '900',
  10,
);

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User, UserWallet, WalletSession, PasswordResetToken]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: jwtAccessExpiresInSeconds,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, StellarSignatureStrategy, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
