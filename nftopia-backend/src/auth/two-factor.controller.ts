import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  RecoverTwoFactorDto,
  RegenerateBackupCodesDto,
  TwoFactorChallengeDto,
  TwoFactorEnableResponseDto,
  TwoFactorRecoveryDto,
  TwoFactorStatusResponseDto,
  VerifyTwoFactorDto,
} from './dto/two-factor.dto';

type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
};

@ApiTags('2FA')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('enable')
  @ApiOperation({
    summary: 'Generate TOTP secret and QR code for enabling 2FA',
  })
  async enableTwoFactor(
    @Req() req: RequestWithUser,
    @Body() dto: EnableTwoFactorDto,
  ): Promise<{ data: TwoFactorEnableResponseDto }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const result = await this.twoFactorService.generateSecret(user, dto.issuer);

    return {
      data: {
        secret: result.secret,
        qrCode: result.qrCode,
        otpauthUrl: result.otpauthUrl,
        backupCodes: result.backupCodes,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('verify')
  @ApiOperation({
    summary: 'Verify TOTP code and enable 2FA for user',
  })
  async verifyAndEnable(
    @Req() req: RequestWithUser,
    @Body() dto: VerifyTwoFactorDto,
  ): Promise<{ data: { success: boolean; message: string } }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.twoFactorService.verifyAndEnable(user, dto.code);

    return {
      data: {
        success: true,
        message: '2FA has been enabled successfully',
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('disable')
  @ApiOperation({
    summary: 'Disable 2FA with TOTP verification',
  })
  async disableTwoFactor(
    @Req() req: RequestWithUser,
    @Body() dto: DisableTwoFactorDto,
  ): Promise<{ data: { success: boolean; message: string } }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.twoFactorService.disableWithTotp(user, dto.code);

    return {
      data: {
        success: true,
        message: '2FA has been disabled successfully',
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('recover')
  @ApiOperation({
    summary: 'Disable 2FA using backup code',
  })
  async recoverTwoFactor(
    @Req() req: RequestWithUser,
    @Body() dto: RecoverTwoFactorDto,
  ): Promise<{ data: { success: boolean; message: string } }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.twoFactorService.disableWithBackupCode(user, dto.backupCode);

    return {
      data: {
        success: true,
        message: '2FA has been disabled using backup code',
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('regenerate-backup-codes')
  @ApiOperation({
    summary: 'Regenerate backup codes for 2FA',
  })
  async regenerateBackupCodes(
    @Req() req: RequestWithUser,
    @Body() dto: RegenerateBackupCodesDto,
  ): Promise<{ data: { backupCodes: string[] } }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      user,
      dto.code,
    );

    return {
      data: { backupCodes },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('status')
  @ApiOperation({
    summary: 'Get 2FA status for current user',
  })
  async getTwoFactorStatus(
    @Req() req: RequestWithUser,
  ): Promise<{ data: TwoFactorStatusResponseDto }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const status = await this.twoFactorService.getTwoFactorStatus(user);

    return { data: status };
  }

  @Post('challenge')
  @ApiOperation({
    summary: 'Verify 2FA challenge during login',
  })
  async verifyChallenge(@Body() dto: TwoFactorChallengeDto): Promise<{
    data: { access_token: string; refresh_token: string; user: any };
  }> {
    const result = await this.twoFactorService.verifyTwoFactorChallenge(
      dto.tempToken,
      dto.code,
    );

    if (!result.verified || !result.user) {
      throw new UnauthorizedException(
        result.error || '2FA verification failed',
      );
    }

    // Generate full JWT tokens
    const authResponse = await this.authService.buildAuthResponse(result.user);

    return {
      data: authResponse,
    };
  }

  @Post('recovery')
  @ApiOperation({
    summary: 'Recover 2FA using backup code during login',
  })
  async verifyRecovery(@Body() dto: TwoFactorRecoveryDto): Promise<{
    data: { access_token: string; refresh_token: string; user: any };
  }> {
    const result = await this.twoFactorService.verifyRecoveryChallenge(
      dto.tempToken,
      dto.backupCode,
    );

    if (!result.verified || !result.user) {
      throw new UnauthorizedException(result.error || '2FA recovery failed');
    }

    // Generate full JWT tokens
    const authResponse = await this.authService.buildAuthResponse(result.user);

    return {
      data: authResponse,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('backup-codes')
  @ApiOperation({
    summary: 'Revoke all backup codes (requires TOTP verification)',
  })
  async revokeBackupCodes(
    @Req() req: RequestWithUser,
    @Body() dto: VerifyTwoFactorDto,
  ): Promise<{ data: { success: boolean; message: string } }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.twoFactorService.revokeBackupCodes(user, dto.code);

    return {
      data: {
        success: true,
        message: 'All backup codes have been revoked',
      },
    };
  }
}
