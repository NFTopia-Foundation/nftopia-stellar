import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { EmailLoginDto, EmailRegisterDto } from './dto/email-auth.dto';
import {
  WalletChallengeDto,
  WalletChallengeResponseDto,
} from './dto/wallet-challenge.dto';
import {
  WalletLinkDto,
  WalletUnlinkDto,
  WalletVerifyDto,
} from './dto/wallet-auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email and password' })
  register(@Body() dto: EmailRegisterDto) {
    return this.authService.registerWithEmail(dto);
  }

  @Post('email/login')
  @ApiOperation({ summary: 'Login with email and password' })
  emailLogin(@Body() dto: EmailLoginDto) {
    return this.authService.loginWithEmail(dto);
  }

  @Post('wallet/challenge')
  @ApiOperation({ summary: 'Generate nonce challenge for Stellar wallet auth' })
  createWalletChallenge(
    @Body() dto: WalletChallengeDto,
    @Req() req: Request,
  ): Promise<WalletChallengeResponseDto> {
    return this.authService.generateWalletChallenge(dto, req.ip);
  }

  @Post('wallet/verify')
  @ApiOperation({
    summary: 'Verify Stellar wallet signature and issue JWT tokens',
  })
  verifyWalletChallenge(@Body() dto: WalletVerifyDto) {
    return this.authService.verifyWalletChallenge(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('wallet/link')
  @ApiOperation({
    summary: 'Link an additional Stellar wallet to current user',
  })
  async linkWallet(@Req() req: RequestWithUser, @Body() dto: WalletLinkDto) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    return this.authService.linkWallet(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('wallet/unlink')
  @ApiOperation({
    summary: 'Unlink a Stellar wallet from current user account',
  })
  async unlinkWalletDelete(
    @Req() req: RequestWithUser,
    @Body() dto: WalletUnlinkDto,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    return this.authService.unlinkWallet(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('wallet/unlink')
  @ApiOperation({
    summary: 'Legacy alias: unlink a Stellar wallet from current user account',
  })
  async unlinkWallet(
    @Req() req: RequestWithUser,
    @Body() dto: WalletUnlinkDto,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    return this.authService.unlinkWallet(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('wallet/sessions')
  @ApiOperation({ summary: 'List active wallet sessions for current user' })
  async getWalletSessions(@Req() req: RequestWithUser) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    return this.authService.listActiveWalletSessions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('wallet/sessions/:id')
  @ApiOperation({ summary: 'Terminate wallet session for current user' })
  async terminateWalletSession(
    @Req() req: RequestWithUser,
    @Param('id') sessionId: string,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    return this.authService.terminateWalletSession(req.user.userId, sessionId);
  }

  @Post('challenge')
  @ApiOperation({ summary: 'Legacy alias for wallet challenge endpoint' })
  legacyChallenge(
    @Body() dto: WalletChallengeDto,
    @Req() req: Request,
  ): Promise<WalletChallengeResponseDto> {
    return this.authService.generateWalletChallenge(dto, req.ip);
  }

  @Post('login')
  @ApiOperation({ summary: 'Legacy alias for wallet verify endpoint' })
  legacyLogin(@Body() dto: WalletVerifyDto) {
    return this.authService.verifyWalletChallenge(dto);
  }
}
