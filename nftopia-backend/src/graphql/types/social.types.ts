import { Field, ID, ObjectType, GraphQLISODateTime } from '@nestjs/graphql';
import { GraphqlUserType } from './user.types';

export enum ActivityType {
  NFT_MINTED = 'NFT_MINTED',
  NFT_PURCHASED = 'NFT_PURCHASED',
  NFT_SOLD = 'NFT_SOLD',
  AUCTION_CREATED = 'AUCTION_CREATED',
  AUCTION_WON = 'AUCTION_WON',
  BID_PLACED = 'BID_PLACED',
  COLLECTION_CREATED = 'COLLECTION_CREATED',
  COLLECTION_FOLLOWED = 'COLLECTION_FOLLOWED',
  USER_FOLLOWED = 'USER_FOLLOWED',
  AUCTION_SETTLED = 'AUCTION_SETTLED',
}

@ObjectType('Follow')
export class GraphqlFollow {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  followerId: string;

  @Field(() => ID)
  followingId: string;

  @Field(() => GraphqlUserType, { nullable: true })
  follower?: GraphqlUserType;

  @Field(() => GraphqlUserType, { nullable: true })
  following?: GraphqlUserType;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}

@ObjectType('Activity')
export class GraphqlActivity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  actorId: string;

  @Field(() => String)
  activityType: string;

  @Field(() => ID, { nullable: true })
  targetId?: string;

  @Field(() => GraphqlUserType, { nullable: true })
  actor?: GraphqlUserType;

  @Field(() => GraphqlUserType, { nullable: true })
  target?: GraphqlUserType;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => String, { nullable: true })
  metadata?: string;
}
