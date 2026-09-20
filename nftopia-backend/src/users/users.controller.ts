import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { UsersService } from './users.service';
import { GdprExportService } from './gdpr-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { RequestDeletionDto } from './dto/request-deletion.dto';
import { VerifyDeletionDto } from './dto/verify-deletion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DEFAULT_EXPORT_FORMAT } from './gdpr.constants';

type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
};

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gdprExportService: GdprExportService,
    private readonly accountDeletionService: AccountDeletionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('wallets')
  async listMyWallets(@Req() req: RequestWithUser) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.usersService.listWallets(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/earnings')
  async getMyEarnings(@Req() req: RequestWithUser) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    const volume = await this.usersService.getUserTransactionVolume(
      req.user.userId,
    );
    return {
      data: {
        success: true,
        data: {
          earnings: volume,
        },
      },
    };
  }

  // ── GDPR: data export ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('export')
  @ApiOperation({
    summary: 'Export all personal data for the authenticated user',
  })
  async exportMyData(
    @Req() req: RequestWithUser,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const userId = this.requireUserId(req);
    const formatted = await this.gdprExportService.exportNow(
      userId,
      query.format ?? DEFAULT_EXPORT_FORMAT,
      auditContext(req),
    );
    res.setHeader('Content-Type', formatted.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${formatted.filename}"`,
    );
    res.send(formatted.body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('export/async')
  @ApiOperation({ summary: 'Queue an asynchronous personal-data export job' })
  async requestAsyncExport(
    @Req() req: RequestWithUser,
    @Query() query: ExportQueryDto,
  ) {
    const userId = this.requireUserId(req);
    const result = await this.gdprExportService.requestAsyncExport(
      userId,
      query.format ?? DEFAULT_EXPORT_FORMAT,
      auditContext(req),
    );
    return { data: { success: true, data: result } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('export/jobs/:jobId')
  @ApiOperation({ summary: 'Get the status/result of an async export job' })
  async getExportJob(
    @Req() req: RequestWithUser,
    @Param('jobId') jobId: string,
  ) {
    const userId = this.requireUserId(req);
    const job = await this.gdprExportService.getJob(userId, jobId);
    return { data: { success: true, data: job } };
  }

  // ── GDPR: right to erasure ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('account')
  @ApiOperation({
    summary: 'Request account deletion (requires ?confirm=true)',
  })
  async deleteMyAccount(
    @Req() req: RequestWithUser,
    @Query('confirm') confirm: string | boolean | undefined,
    @Body() dto: RequestDeletionDto,
  ) {
    const userId = this.requireUserId(req);
    if (confirm !== true && confirm !== 'true' && confirm !== '1') {
      throw new BadRequestException(
        'Account deletion requires explicit confirmation: pass ?confirm=true',
      );
    }
    const result = await this.accountDeletionService.requestDeletion(
      userId,
      { token: dto.token, reason: dto.reason },
      auditContext(req),
    );
    return { data: { success: true, data: result } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('account/deletion/verify')
  @ApiOperation({ summary: 'Confirm account deletion using an emailed token' })
  async verifyAccountDeletion(
    @Req() req: RequestWithUser,
    @Body() dto: VerifyDeletionDto,
  ) {
    const userId = this.requireUserId(req);
    const result = await this.accountDeletionService.verifyDeletion(
      userId,
      dto.token,
      auditContext(req),
    );
    return { data: { success: true, data: result } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('account/deletion/cancel')
  @ApiOperation({ summary: 'Cancel a pending account deletion request' })
  async cancelAccountDeletion(@Req() req: RequestWithUser) {
    const userId = this.requireUserId(req);
    const result = await this.accountDeletionService.cancelDeletion(
      userId,
      auditContext(req),
    );
    return { data: { success: true, data: result } };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('account/deletion')
  @ApiOperation({ summary: 'Get the current account deletion request status' })
  async getAccountDeletionStatus(@Req() req: RequestWithUser) {
    const userId = this.requireUserId(req);
    const status = await this.accountDeletionService.getStatus(userId);
    return { data: { success: true, data: status } };
  }

  @Get(':address')
  async getPublicProfile(@Param('address') address: string) {
    const user =
      (await this.usersService.findByStellarAddress(address)) ??
      (await this.usersService.findByUsername(address));
    if (!user || user.isBanned || user.isAnonymized) {
      throw new NotFoundException('User not found');
    }
    const publicFields = { ...user };
    delete publicFields.email;
    delete publicFields.passwordHash;
    return publicFields;
  }

  // TEMP ownership enforcement
  @Patch('me')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  updateMe(
    @Headers('x-wallet-address') address: string,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!address) {
      throw new UnauthorizedException('Missing wallet address');
    }
    return this.usersService.updateProfile(address, dto);
  }

  private requireUserId(req: RequestWithUser): string {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return req.user.userId;
  }
}

function auditContext(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}
