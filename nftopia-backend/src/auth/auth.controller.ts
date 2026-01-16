import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import type { CookieOptions } from 'express';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RequestWithUser } from '../types/RequestWithUser';

@Controller('auth')
export class AuthController {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  private async generateTokens(user: User) {
    const payload = { sub: user.id, walletAddress: user.walletAddress };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }

  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  }

  @Post('request-nonce')
  @HttpCode(200)
  requestNonce(@Body('walletAddress') walletAddress: string) {
    const nonce = this.authService.generateNonce(walletAddress);
    console.log(`walletAddres: ${walletAddress}`);
    console.log(`nonce: ${nonce}`)
    return { nonce };
  }


@Post('verify-signature')
@HttpCode(200)
async verifySignature(
  @Body('walletAddress') walletAddress: string,
  @Body('signature') signature: [string, string],
  @Body('nonce') nonce: string,
  @Body('walletType') walletType: 'argentx' | 'braavos',
  @Res({ passthrough: true }) res: Response,
) {


  console.log(walletAddress);
  console.log(signature);
  console.log(nonce);
  console.log(walletType);
  // Validate request format
  if (!walletAddress || typeof walletAddress !== 'string') {
    throw new BadRequestException('walletAddress must be a non-empty string');
  }

  if (
    !Array.isArray(signature) ||
    signature.length !== 2 ||
    !signature.every((val) => typeof val === 'string')
  ) {
    throw new BadRequestException('signature must be a [string, string] array');
  }

  if (!nonce || typeof nonce !== 'string') {
    throw new BadRequestException('nonce must be a string');
  }

  if (!['argentx', 'braavos'].includes(walletType)) {
    throw new BadRequestException('walletType must be "argentx" or "braavos"');
  }

  const { accessToken, refreshToken, user } =
    await this.authService.verifySignature(
      walletAddress,
      signature,
      nonce,
      walletType,
    );

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };

  res.cookie('access_token', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie('auth-user', user, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { message: 'Authenticated', user: user };
}
  

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: RequestWithUser) {
    console.log(req['user']);
    return req['user'];
  }


  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException();

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();

      const tokens = await this.generateTokens(user);

      res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return { message: 'Refreshed successfully' };
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    try {
      // Clear all authentication cookies with secure options
      const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };

      // Clear access token
      res.clearCookie('access_token', cookieOptions);
      
      // Clear refresh token
      res.clearCookie('refresh_token', cookieOptions);
      
      // Clear auth user data
      res.clearCookie('auth-user', cookieOptions);

      // For additional security, set expired cookies
      res.cookie('access_token', '', {
        ...cookieOptions,
        expires: new Date(0),
      });

      res.cookie('refresh_token', '', {
        ...cookieOptions,
        expires: new Date(0),
      });

      res.cookie('auth-user', '', {
        ...cookieOptions,
        expires: new Date(0),
      });

      // Return 204 No Content for successful logout
      return res.status(204).send();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear the cookies for security
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      res.clearCookie('auth-user');
      return res.status(500).json({ message: 'Logout failed' });
    }
  }
}
