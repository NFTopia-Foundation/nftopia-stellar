import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('User')
export class GraphqlUserProfile {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  username?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  walletAddress?: string;
}
