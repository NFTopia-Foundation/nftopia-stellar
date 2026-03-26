import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
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

  @Get(':address')
  getPublicProfile(@Param('address') address: string) {
    return this.usersService.findByAddress(address);
  }

  // TEMP ownership enforcement
  @Patch('me')
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
