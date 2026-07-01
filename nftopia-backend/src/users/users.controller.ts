import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type RequestWithUser = Request & {
  user?: {
    userId: string;
  };
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
