import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
    });
  }

  async validate(payload: {
    sub: string;
    username?: string;
    email?: string;
    role?: string;
    stellarAddress?: string;
    twoFactorVerified?: boolean;
  }) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: { id: true, anonymizedAt: true },
    });
    if (!user || user.anonymizedAt) {
      throw new UnauthorizedException('Account is no longer available');
    }

    // Return user object with role and 2FA status from JWT payload
    return {
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role, // Ensure role is included in JWT payload
      stellarAddress: payload.stellarAddress,
      twoFactorVerified: payload.twoFactorVerified || false,
    };
  }
}
