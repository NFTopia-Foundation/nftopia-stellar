import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SocialService } from './social.service';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    [key: string]: unknown;
  };
}

@Controller('social')
@UseGuards(JwtAuthGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  /**
   * Follow a user
   * POST /social/users/:id/follow
   */
  @Post('users/:id/follow')
  async followUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') followingId: string,
  ) {
    const followerId = req.user.userId;
    const result = await this.socialService.followUser(followerId, followingId);
    return {
      success: true,
      data: result,
      message: 'Successfully followed user',
    };
  }

  /**
   * Unfollow a user
   * DELETE /social/users/:id/follow
   */
  @Delete('users/:id/follow')
  async unfollowUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') followingId: string,
  ) {
    const followerId = req.user.userId;
    await this.socialService.unfollowUser(followerId, followingId);
    return {
      success: true,
      message: 'Successfully unfollowed user',
    };
  }

  /**
   * Get followers of a user
   * GET /social/users/:id/followers
   */
  @Get('users/:id/followers')
  async getFollowers(
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.socialService.getFollowers(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Get users that a user is following
   * GET /social/users/:id/following
   */
  @Get('users/:id/following')
  async getFollowing(
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.socialService.getFollowing(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Get follower counts
   * GET /social/users/:id/counts
   */
  @Get('users/:id/counts')
  async getFollowCounts(@Param('id') userId: string) {
    const [followers, following] = await Promise.all([
      this.socialService.getFollowersCount(userId),
      this.socialService.getFollowingCount(userId),
    ]);

    return {
      followers,
      following,
    };
  }

  /**
   * Check if following
   * GET /social/check-follow/:id
   */
  @Get('check-follow/:id')
  async checkFollow(
    @Request() req: AuthenticatedRequest,
    @Param('id') followingId: string,
  ) {
    const followerId = req.user.userId;
    const isFollowing = await this.socialService.isFollowing(
      followerId,
      followingId,
    );
    return { isFollowing };
  }

  /**
   * Get mutual follows between current user and another user
   * GET /social/mutual/:id
   */
  @Get('mutual/:id')
  async getMutualFollows(
    @Request() req: AuthenticatedRequest,
    @Param('id') otherUserId: string,
  ) {
    const userId = req.user.userId;
    return this.socialService.getMutualFollows(userId, otherUserId);
  }

  /**
   * Get feed for current user
   * GET /social/feed
   */
  @Get('feed')
  async getFeed(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const userId = req.user.userId;
    const beforeDate = before ? new Date(before) : undefined;

    if (beforeDate && isNaN(beforeDate.getTime())) {
      throw new BadRequestException(
        'Invalid date format for "before" parameter',
      );
    }

    return this.socialService.getFeed(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      beforeDate,
    );
  }

  /**
   * Get activities for a specific user
   * GET /social/users/:id/activities
   */
  @Get('users/:id/activities')
  async getUserActivities(
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.socialService.getUserActivities(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Get suggested users to follow
   * GET /social/suggestions
   */
  @Get('suggestions')
  async getSuggestions(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId;
    const suggestions = await this.socialService.getSuggestedUsers(
      userId,
      limit ? parseInt(limit, 10) : 10,
    );
    return {
      data: suggestions,
      count: suggestions.length,
    };
  }
}
