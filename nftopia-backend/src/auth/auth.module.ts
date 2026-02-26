import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { StellarStrategy } from './stellar.strategy';
import { JwtStrategy } from './jwt.strategy';
import { StellarSignatureGuard } from './stellar-signature.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'secretKey', // TODO: Use environment variable
      signOptions: { expiresIn: '60m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, StellarStrategy, JwtStrategy, StellarSignatureGuard],
  exports: [AuthService, JwtStrategy, StellarSignatureGuard],
})
export class AuthModule {}
