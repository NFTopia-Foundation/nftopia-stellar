import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
    });
  }

  validate(payload: {
    sub: string;
    username?: string;
    email?: string;
    role?: string;
    stellarAddress?: string;
  }) {
    // Return user object with role from JWT payload
    return {
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role, // Ensure role is included in JWT payload
      stellarAddress: payload.stellarAddress,
    };
  }
}
