import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, LessThan, Not } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { Activity, ActivityType } from './entities/activity.entity';
import { User } from '../../users/user.entity';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string): Promise<Follow> {
    // Prevent self-follow
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Check if user exists
    const user = await this.userRepository.findOne({
      where: { id: followingId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${followingId} not found`);
    }

    // Check if already following
    const existingFollow = await this.followRepository.findOne({
      where: {
        followerId,
        followingId,
      },
    });

    if (existingFollow) {
      throw new BadRequestException('Already following this user');
    }

    const follow = this.followRepository.create({
      followerId,
      followingId,
    });

    await this.followRepository.save(follow);

    // Create activity for following
    await this.createActivity({
      actorId: followerId,
      activityType: ActivityType.USER_FOLLOWED,
      targetId: followingId,
      metadata: {
        followedUsername: user.username || user.walletAddress,
        followedId: followingId,
      },
    });

    this.logger.log(`User ${followerId} followed ${followingId}`);
    return follow;
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const result = await this.followRepository.delete({
      followerId,
      followingId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Follow relationship not found');
    }

    this.logger.log(`User ${followerId} unfollowed ${followingId}`);
  }

  /**
   * Check if following
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const count = await this.followRepository.count({
      where: {
        followerId,
        followingId,
      },
    });
    return count > 0;
  }

  /**
   * Get followers count for a user
   */
  async getFollowersCount(userId: string): Promise<number> {
    return this.followRepository.count({
      where: { followingId: userId },
    });
  }

  /**
   * Get following count for a user
   */
  async getFollowingCount(userId: string): Promise<number> {
    return this.followRepository.count({
      where: { followerId: userId },
    });
  }

  /**
   * Get followers of a user
   */
  async getFollowers(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [follows, total] = await this.followRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      skip,
      take: limit + 1,
      order: { createdAt: 'DESC' },
    });

    const hasMore = follows.length > limit;
    const data = follows.slice(0, limit).map((f) => f.follower);

    return {
      data,
      total,
      page,
      limit,
      hasMore,
    };
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [follows, total] = await this.followRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      skip,
      take: limit + 1,
      order: { createdAt: 'DESC' },
    });

    const hasMore = follows.length > limit;
    const data = follows.slice(0, limit).map((f) => f.following);

    return {
      data,
      total,
      page,
      limit,
      hasMore,
    };
  }

  /**
   * Create an activity
   */
  async createActivity(params: {
    actorId: string;
    activityType: ActivityType;
    targetId?: string;
    metadata?: Record<string, any>;
    collectionId?: string;
    nftId?: string;
  }): Promise<Activity> {
    const activity = this.activityRepository.create(params);
    const saved = await this.activityRepository.save(activity);

    // Clean up old activities (keep last 1000 per user)
    await this.cleanupOldActivities(params.actorId);

    return saved;
  }

  /**
   * Cleanup old activities for a user
   */
  private async cleanupOldActivities(actorId: string): Promise<void> {
    const count = await this.activityRepository.count({
      where: { actorId },
    });

    if (count > 1000) {
      const toDelete = await this.activityRepository
        .createQueryBuilder('a')
        .where('a.actorId = :actorId', { actorId })
        .orderBy('a.createdAt', 'DESC')
        .skip(1000)
        .take(count - 1000)
        .getMany();

      if (toDelete.length > 0) {
        await this.activityRepository.remove(toDelete);
      }
    }
  }

  /**
   * Get feed for a user (activities from followed users)
   */
  async getFeed(
    userId: string,
    page: number = 1,
    limit: number = 20,
    before?: Date,
  ): Promise<{
    data: Activity[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    // Get followed user IDs
    const follows = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followedIds = follows.map((f) => f.followingId);

    if (followedIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      };
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: FindOptionsWhere<Activity> = {
      actorId: In(followedIds),
    };

    if (before) {
      where.createdAt = LessThan(before);
    }

    const [activities, total] = await this.activityRepository.findAndCount({
      where,
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit + 1,
    });

    const hasMore = activities.length > limit;
    const data = activities.slice(0, limit);

    return {
      data,
      total,
      page,
      limit,
      hasMore,
    };
  }

  /**
   * Get user activities
   */
  async getUserActivities(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Activity[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [activities, total] = await this.activityRepository.findAndCount({
      where: { actorId: userId },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit + 1,
    });

    const hasMore = activities.length > limit;
    const data = activities.slice(0, limit);

    return {
      data,
      total,
      page,
      limit,
      hasMore,
    };
  }

  /**
   * Get mutual follows between two users
   */
  async getMutualFollows(userId: string, otherUserId: string): Promise<{
    userFollowsOther: boolean;
    otherFollowsUser: boolean;
  }> {
    const [userFollowsOther, otherFollowsUser] = await Promise.all([
      this.isFollowing(userId, otherUserId),
      this.isFollowing(otherUserId, userId),
    ]);

    return {
      userFollowsOther,
      otherFollowsUser,
    };
  }

  /**
   * Get suggested users to follow (users followed by followed users)
   */
  async getSuggestedUsers(
    userId: string,
    limit: number = 10,
  ): Promise<User[]> {
    // Get users this user follows
    const follows = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followedIds = follows.map((f) => f.followingId);

    if (followedIds.length === 0) {
      // If not following anyone, return popular users
      return this.userRepository.find({
        where: { id: Not(userId) },
        take: limit,
        order: { createdAt: 'DESC' },
      });
    }

    // Get users that followed users follow (2nd degree)
    const secondDegree = await this.followRepository
      .createQueryBuilder('f')
      .where('f.followerId IN (:...followedIds)', { followedIds })
      .andWhere('f.followingId NOT IN (:...followedIds)', { followedIds })
      .andWhere('f.followingId != :userId', { userId })
      .select('f.followingId', 'id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('f.followingId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    const suggestedIds = secondDegree.map((s) => s.id);

    if (suggestedIds.length === 0) {
      return this.userRepository.find({
        where: { id: Not(userId) },
        take: limit,
        order: { createdAt: 'DESC' },
      });
    }

    return this.userRepository.find({
      where: { id: In(suggestedIds) },
    });
  }
}