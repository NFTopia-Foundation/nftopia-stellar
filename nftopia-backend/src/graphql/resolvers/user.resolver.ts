import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import type { User } from '../../users/user.entity';
import { GraphqlUser } from '../types/user.types';

@Resolver(() => GraphqlUser)
export class UserResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => GraphqlUser, {
    name: 'user',
    description: 'Fetch a user by ID',
  })
  async user(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GraphqlUser> {
    const u = await this.usersService.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return this.toGraphqlUser(u);
  }

  @Query(() => GraphqlUser, {
    name: 'userByAddress',
    description: 'Fetch a user by their Stellar address',
  })
  async userByAddress(
    @Args('address') address: string,
  ): Promise<GraphqlUser> {
    const u = await this.usersService.findByAddress(address);
    if (!u) throw new NotFoundException('User not found');
    return this.toGraphqlUser(u);
  }

  private toGraphqlUser(u: User): GraphqlUser {
    return {
      id: u.id,
      address: u.address ?? null,
      email: u.email ?? null,
      username: u.username,
      bio: u.bio,
      avatarUrl: u.avatarUrl,
      walletAddress: u.walletAddress ?? null,
      isEmailVerified: u.isEmailVerified,
      lastLoginAt: u.lastLoginAt ?? null,
    };
  }
}
