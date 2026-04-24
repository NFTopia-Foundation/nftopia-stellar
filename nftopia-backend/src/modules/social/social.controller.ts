import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';

@Controller()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @UseGuards(JwtAuthGuard)
  @Post('users/:id/follow')
  async follow(
    @Param('id') followingId: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const followerId = req.user?.userId as string;
    return this.socialService.follow(followerId, followingId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id/follow')
  async unfollow(
    @Param('id') followingId: string,
    @Req() req: ExpressRequest & { user?: { userId?: string } },
  ) {
    const followerId = req.user?.userId as string;
    return this.socialService.unfollow(followerId, followingId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  async feed(
    @Req() req: ExpressRequest & { user?: { userId?: string } },
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId as string;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.socialService.getFeed(userId, parsedLimit);
  }
}
