import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { NFTConnection, PageInfo } from './nft.types';

@ObjectType('Collection')
export class GraphqlCollection {
  @Field(() => ID)
  id: string;

  @Field()
  contractAddress: string;

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

  @Field(() => NFTConnection, {
    nullable: true,
    description: 'NFTs that belong to this collection',
  })
  nfts?: NFTConnection;
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
