import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { NFTConnection } from './nft.types';
import { PageInfo } from './common.types';
import { GraphqlUserType } from './user.types';

@ObjectType('Collection')
export class GraphqlCollection {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  contractAddress?: string | null;

  @Field()
  name: string;

  @Field()
  symbol: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String)
  image: string;

  @Field(() => ID)
  creatorId: string;

  @Field(() => String)
  totalVolume: string;

  @Field(() => String)
  floorPrice: string;

  @Field(() => Int)
  totalSupply: number;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphqlUserType, { nullable: true })
  creator?: GraphqlUserType | null;

  @Field(() => NFTConnection, {
    nullable: true,
    description: 'NFTs that belong to this collection',
  })
  nfts?: NFTConnection;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  likes?: number;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isVerified?: boolean;
}

@ObjectType()
export class CollectionEdge {
  @Field(() => GraphqlCollection)
  node: GraphqlCollection;

  @Field()
  cursor: string;
}

@ObjectType()
export class CollectionConnection {
  @Field(() => [CollectionEdge])
  edges: CollectionEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class CollectionStats {
  @Field(() => String)
  totalVolume: string;

  @Field(() => String)
  floorPrice: string;

  @Field(() => Int)
  totalSupply: number;

  @Field(() => Int)
  ownerCount: number;
}

// NEW: Like-related types
@ObjectType()
export class LikeCollectionResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => ID)
  collectionId: string;

  @Field(() => Int)
  likesCount: number;

  @Field(() => Boolean)
  userLiked: boolean;

  @Field(() => String, { nullable: true })
  message?: string;
}

@ObjectType()
export class UnlikeCollectionResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => ID)
  collectionId: string;

  @Field(() => Int)
  likesCount: number;

  @Field(() => Boolean)
  userLiked: boolean;

  @Field(() => String, { nullable: true })
  message?: string;
}

@ObjectType()
export class CollectionLikesInfo {
  @Field(() => Int)
  count: number;

  @Field(() => Boolean)
  isLiked: boolean;
}
