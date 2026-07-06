import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { SocialService } from '../../modules/social/social.service';
import { GraphqlFollow, GraphqlActivity } from '../types/social.types';
import { GraphqlUserType } from '../types/user.types';
import type { GraphqlContext } from '../context/context.interface';
import type { Activity } from '../../modules/social/entities/activity.entity';
import type { Follow } from '../../modules/social/entities/follow.entity';
import type { User } from '../../users/user.entity';

@Resolver()
export class SocialResolver {
  constructor(private readonly socialService: SocialService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphqlFollow, {
    name: 'followUser',
    description: 'Follow a user',
  })
  async followUser(
    @Args('userId', { type: () => ID }) userId: string,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlFollow> {
    const followerId = context.user?.userId;
    if (!followerId) {
      throw new Error('Authentication required');
    }
    const follow = await this.socialService.followUser(followerId, userId);
    return this.toGraphqlFollow(follow);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, {
    name: 'unfollowUser',
    description: 'Unfollow a user',
  })
  async unfollowUser(
    @Args('userId', { type: () => ID }) userId: string,
    @Context() context: GraphqlContext,
  ): Promise<boolean> {
    const followerId = context.user?.userId;
    if (!followerId) {
      throw new Error('Authentication required');
    }
    await this.socialService.unfollowUser(followerId, userId);
    return true;
  }

  @Query(() => [GraphqlUserType], {
    name: 'followers',
    description: 'Get followers of a user',
  })
  async getFollowers(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('page', { type: () => Number, nullable: true }) page?: number,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<GraphqlUserType[]> {
    const result = await this.socialService.getFollowers(
      userId,
      page || 1,
      limit || 20,
    );
    return result.data.map((user) => this.toGraphqlUser(user));
  }

  @Query(() => [GraphqlUserType], {
    name: 'following',
    description: 'Get users that a user is following',
  })
  async getFollowing(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('page', { type: () => Number, nullable: true }) page?: number,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<GraphqlUserType[]> {
    const result = await this.socialService.getFollowing(
      userId,
      page || 1,
      limit || 20,
    );
    return result.data.map((user) => this.toGraphqlUser(user));
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [GraphqlActivity], {
    name: 'feed',
    description: 'Get feed for current user',
  })
  async getFeed(
    @Context() context: GraphqlContext,
    @Args('page', { type: () => Number, nullable: true }) page?: number,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ): Promise<GraphqlActivity[]> {
    const userId = context.user?.userId;
    if (!userId) {
      throw new Error('Authentication required');
    }
    const result = await this.socialService.getFeed(
      userId,
      page || 1,
      limit || 20,
    );
    return result.data.map((activity) => this.toGraphqlActivity(activity));
  }

  @Query(() => Boolean, {
    name: 'isFollowing',
    description: 'Check if current user is following another user',
  })
  async isFollowing(
    @Args('userId', { type: () => ID }) userId: string,
    @Context() context: GraphqlContext,
  ): Promise<boolean> {
    const followerId = context.user?.userId;
    if (!followerId) {
      return false;
    }
    return this.socialService.isFollowing(followerId, userId);
  }

  // === HELPER METHODS ===

  private toGraphqlUser(user: User): GraphqlUserType {
    return {
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      walletAddress: user.walletAddress ?? user.address ?? null,
      stellarAddress: user.walletAddress ?? user.address ?? null,
      avatar: user.avatarUrl ?? null,
    };
  }

  private toGraphqlFollow(follow: Follow): GraphqlFollow {
    return {
      id: follow.id,
      followerId: follow.followerId,
      followingId: follow.followingId,
      createdAt: follow.createdAt,
      follower: follow.follower ? this.toGraphqlUser(follow.follower) : undefined,
      following: follow.following ? this.toGraphqlUser(follow.following) : undefined,
    };
  }

  private toGraphqlActivity(activity: Activity): GraphqlActivity {
    return {
      id: activity.id,
      actorId: activity.actorId,
      activityType: activity.activityType,
      targetId: activity.targetId || undefined,
      createdAt: activity.createdAt,
      actor: activity.actor ? this.toGraphqlUser(activity.actor) : undefined,
      metadata: activity.metadata ? JSON.stringify(activity.metadata) : undefined,
    };
  }
}