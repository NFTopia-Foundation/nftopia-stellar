import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
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
import {
  TwoFactorChallengeDto,
  TwoFactorRecoverDto,
  TwoFactorVerifyDto,
} from './dto/two-factor.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Get('csrf-token')
  @ApiOperation({ summary: 'Get CSRF token' })
  getCsrfToken() {
    return {
      csrfToken: 'dummy-csrf-token-for-dev',
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register with email and password' })
  async register(@Body() dto: EmailRegisterDto) {
    const res = await this.authService.registerWithEmail(dto);
    return {
      data: {
        success: true,
        data: res,
      },
    };
  }

  @Post('email/login')
  @ApiOperation({ summary: 'Login with email and password' })
  async emailLogin(@Body() dto: EmailLoginDto) {
    const res = await this.authService.loginWithEmail(dto);
    return {
      data: {
        success: true,
        data: res,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(@Req() req: RequestWithUser) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      data: {
        success: true,
        data: {
          id: user.id,
          address: user.address,
          email: user.email ?? null,
          username: user.username ?? null,
          walletAddress: user.walletAddress ?? null,
          walletProvider: user.walletProvider ?? null,
          avatarUrl: user.avatarUrl ?? null,
          bannerUrl: user.bannerUrl ?? null,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
        },
      },
    };
  }

  // ── 2FA endpoints ────────────────────────────────────────────────────────

  @Post('2fa/challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete 2FA challenge after login (verifies TOTP, returns full JWT)' })
  async twoFactorChallenge(@Body() dto: TwoFactorChallengeDto) {
    const tokens = await this.twoFactorService.completeTwoFactorChallenge(
      dto.pendingToken,
      dto.code,
    );
    return { data: { success: true, data: tokens } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/enable')
  @ApiOperation({ summary: 'Initiate 2FA setup — returns TOTP secret and QR code' })
  async twoFactorInitSetup(@Req() req: RequestWithUser) {
    if (!req.user?.userId) throw new UnauthorizedException('Invalid JWT payload');
    const result = await this.twoFactorService.initSetup(req.user.userId);
    return { data: { success: true, data: result } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify TOTP code to confirm 2FA setup and receive backup codes' })
  async twoFactorEnable(
    @Req() req: RequestWithUser,
    @Body() body: TwoFactorVerifyDto & { secret: string },
  ) {
    if (!req.user?.userId) throw new UnauthorizedException('Invalid JWT payload');
    const result = await this.twoFactorService.enable(
      req.user.userId,
      body.secret,
      body.code,
    );
    return { data: { success: true, data: result } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA using a valid TOTP code' })
  async twoFactorDisable(
    @Req() req: RequestWithUser,
    @Body() dto: TwoFactorVerifyDto,
  ) {
    if (!req.user?.userId) throw new UnauthorizedException('Invalid JWT payload');
    await this.twoFactorService.disable(req.user.userId, dto.code);
    return { data: { success: true } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/recover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA using a backup code (account recovery)' })
  async twoFactorRecover(
    @Req() req: RequestWithUser,
    @Body() dto: TwoFactorRecoverDto,
  ) {
    if (!req.user?.userId) throw new UnauthorizedException('Invalid JWT payload');
    await this.twoFactorService.recover(req.user.userId, dto.backupCode);
    return { data: { success: true } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('2fa/backup-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate 2FA backup codes (requires valid TOTP code)' })
  async twoFactorRegenerateBackupCodes(
    @Req() req: RequestWithUser,
    @Body() dto: TwoFactorVerifyDto,
  ) {
    if (!req.user?.userId) throw new UnauthorizedException('Invalid JWT payload');
    const result = await this.twoFactorService.regenerateBackupCodes(
      req.user.userId,
      dto.code,
    );
    return { data: { success: true, data: result } };
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
  async verifyWalletChallenge(@Body() dto: WalletVerifyDto) {
    const res = await this.authService.verifyWalletChallenge(dto);
    return {
      data: {
        success: true,
        data: res,
      },
    };
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

    const res = await this.authService.linkWallet(req.user.userId, dto);
    return {
      data: {
        success: true,
        data: res,
      },
    };
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

    const res = await this.authService.unlinkWallet(req.user.userId, dto);
    return {
      data: {
        success: true,
        data: res,
      },
    };
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

    const res = await this.authService.unlinkWallet(req.user.userId, dto);
    return {
      data: {
        success: true,
        data: res,
      },
    };
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('list-wallets')
  @ApiOperation({
    summary: 'List linked wallets for current user (frontend alias)',
  })
  async listWallets(@Req() req: RequestWithUser) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    const wallets = await this.authService.listUserWallets(req.user.userId);
    return { data: { success: true, data: wallets } };
  }

  @Post('wallet-challenge')
  @ApiOperation({ summary: 'Stellar wallet challenge (frontend alias)' })
  async aliasWalletChallenge(
    @Body() dto: WalletChallengeDto,
    @Req() req: Request,
  ) {
    const res = await this.authService.generateWalletChallenge(dto, req.ip);
    return { data: { success: true, data: res } };
  }

  @Post('verify-wallet-signature')
  @ApiOperation({ summary: 'Verify Stellar wallet signature (frontend alias)' })
  async aliasVerifyWalletSignature(@Body() dto: WalletVerifyDto) {
    const res = await this.authService.verifyWalletChallenge(dto);
    return { data: { success: true, data: res } };
  }

  @Post('link-wallet')
  @ApiOperation({ summary: 'Link wallet (frontend alias)' })
  async aliasLinkWallet(
    @Req() req: RequestWithUser,
    @Body() dto: WalletLinkDto,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    const res = await this.authService.linkWallet(req.user.userId, dto);
    return { data: { success: true, data: res } };
  }

  @Post('unlink-wallet')
  @ApiOperation({ summary: 'Unlink wallet (frontend alias)' })
  async aliasUnlinkWallet(
    @Req() req: RequestWithUser,
    @Body() dto: WalletUnlinkDto,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    const res = await this.authService.unlinkWallet(req.user.userId, dto);
    return { data: { success: true, data: res } };
  }

  @Post('request-nonce')
  @ApiOperation({ summary: 'Request nonce (frontend alias)' })
  async aliasRequestNonce(
    @Body() dto: WalletChallengeDto,
    @Req() req: Request,
  ) {
    const res = await this.authService.generateWalletChallenge(dto, req.ip);
    return { data: { success: true, data: res } };
  }

  @Post('verify-signature')
  @ApiOperation({ summary: 'Verify signature (frontend alias)' })
  async aliasVerifySignature(@Body() dto: WalletVerifyDto) {
    const res = await this.authService.verifyWalletChallenge(dto);
    return { data: { success: true, data: res } };
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
