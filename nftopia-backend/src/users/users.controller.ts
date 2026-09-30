import {
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
import type { Request, Response } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerifyAccountDeletionDto } from './dto/verify-account-deletion.dto';
import type { UserExportFormat } from './privacy-jobs';

type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async exportMyData(
    @Req() req: RequestWithUser,
    @Query('format') format: string = 'json',
    @Query('async') asyncMode = 'false',
    @Res() res: Response,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    if (!['json', 'csv', 'zip'].includes(format)) {
      throw new NotFoundException('Unsupported export format');
    }

    if (
      asyncMode === 'true' ||
      (await this.usersService.isLargeExport(req.user.userId))
    ) {
      const job = await this.usersService.createExportJob(
        req.user.userId,
        format as UserExportFormat,
      );
      return res.status(202).json(job);
    }

    const file = await this.usersService.requestExportFile(
      req.user.userId,
      format as UserExportFormat,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    return res.send(Buffer.from(file.contentBase64, 'base64'));
  }

  @UseGuards(JwtAuthGuard)
  @Get('export/jobs/:jobId')
  async getExportJob(
    @Req() req: RequestWithUser,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    const result = await this.usersService.getExportJob(req.user.userId, jobId);
    if (result.status !== 'completed' || !result.file) {
      return res.status(result.status === 'failed' ? 500 : 202).json(result);
    }
    res.setHeader('Content-Type', result.file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.file.fileName}"`,
    );
    return res.send(Buffer.from(result.file.contentBase64, 'base64'));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  async requestAccountDeletion(
    @Req() req: RequestWithUser,
    @Query('confirm') confirm: string,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.usersService.requestAccountDeletion(
      req.user.userId,
      confirm === 'true',
      req.ip,
    );
  }

  @Post('account/deletion/verify')
  async verifyAccountDeletion(
    @Body() dto: VerifyAccountDeletionDto,
    @Req() req: Request,
  ) {
    return this.usersService.verifyAccountDeletion(
      dto.token,
      req.ip,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('account/deletion')
  async getAccountDeletionStatus(@Req() req: RequestWithUser) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.usersService.getAccountDeletionStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/deletion/cancel')
  async cancelAccountDeletion(
    @Req() req: RequestWithUser,
  ) {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.usersService.cancelAccountDeletion(req.user.userId, req.ip);
  }

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

  @Get(':address')
  async getPublicProfile(@Param('address') address: string) {
    const user =
      (await this.usersService.findByStellarAddress(address)) ??
      (await this.usersService.findByUsername(address));
    if (!user || user.isBanned) {
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
}
