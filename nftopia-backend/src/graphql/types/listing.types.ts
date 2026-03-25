import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';

export enum ListingStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(ListingStatus, {
  name: 'ListingStatus',
});

@ObjectType()
export class ListingGqlType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  nftId: string;

  @Field(() => ID)
  sellerId: string;

  @Field(() => String)
  price: string;

  @Field(() => String)
  currency: string;

  @Field(() => ListingStatus)
  status: ListingStatus;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt?: Date | null;
}

@ObjectType()
export class ListingEdge {
  @Field(() => String)
  cursor: string;

  @Field(() => ListingGqlType)
  node: ListingGqlType;
}

@ObjectType()
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  endCursor: string | null;
}

@ObjectType()
export class ListingConnection {
  @Field(() => [ListingEdge])
  edges: ListingEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class TransactionResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  txHash?: string;

  @Field(() => String)
  message: string;
}
