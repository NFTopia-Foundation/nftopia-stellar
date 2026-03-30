import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType('User')
export class GraphqlUser {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  username?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String, { nullable: true })
  walletAddress?: string | null;

  @Field()
  isEmailVerified: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastLoginAt?: Date | null;
}
