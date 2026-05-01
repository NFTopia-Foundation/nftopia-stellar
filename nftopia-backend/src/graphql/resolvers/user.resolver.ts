import { Args, Context, ID, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';
import type { GraphqlContext } from '../context/context.interface';
import { GraphqlUserType } from '../types/user.types';
import type { User } from '../../users/user.entity';

@Resolver(() => GraphqlUserType)
export class UserResolver {
  @Query(() => GraphqlUserType, {
    name: 'user',
    description: 'Fetch a single user by ID',
  })
  async user(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: GraphqlContext,
  ): Promise<GraphqlUserType> {
    const user = await context.loaders.userById.load(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toGraphqlUser(user);
  }

  private toGraphqlUser(user: User): GraphqlUserType {
    return {
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      walletAddress: user.walletAddress ?? user.address ?? null,
    };
  }
}
