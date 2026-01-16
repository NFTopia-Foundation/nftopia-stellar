import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token, 
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || "my_secret",
    });
  }

  validate(payload: any) {
    return {
      sub: payload.sub,
      walletAddress: payload.walletAddress,
      isArtist: payload.isArtist,
      username: payload.username,
    };
  }
}

