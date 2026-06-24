import {
  CustomScalar,
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  Scalar,
} from '@nestjs/graphql';
import { Kind, type ValueNode, GraphQLError, GraphQLScalarType } from 'graphql';
import { GraphqlCollection } from './collection.types';
import { GraphqlListing } from './listing.types';
import { GraphqlOrder } from './order.types';
import { GraphqlAuction } from './auction.types';
import { GraphqlUserType } from './user.types';
import { PageInfo } from './common.types';

function parseLiteralNode(node: ValueNode): unknown {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return node.values.map((value) => parseLiteralNode(value));
    case Kind.OBJECT:
      return Object.fromEntries(
        node.fields.map((field) => [
          field.name.value,
          parseLiteralNode(field.value),
        ]),
      );
    default:
      throw new GraphQLError(`Unsupported JSON literal kind: ${node.kind}`);
  }
}

@Scalar('JSON', () => Object)
export class JsonScalar implements CustomScalar<unknown, unknown> {
  description = 'Arbitrary JSON value';

  private readonly scalar = new GraphQLScalarType({
    name: 'JSON',
    description: this.description,
    serialize: (value: unknown) => value,
    parseValue: (value: unknown) => value,
    parseLiteral: (ast: ValueNode) => parseLiteralNode(ast),
  });

  parseValue(value: unknown): unknown {
    return this.scalar.parseValue(value);
  }

  serialize(value: unknown): unknown {
    return this.scalar.serialize(value);
  }

  parseLiteral(ast: ValueNode): unknown {
    return this.scalar.parseLiteral(ast, {});
  }
}

@ObjectType('NFTAttribute')
export class GraphqlNftAttribute {
  @Field(() => String)
  traitType: string;

  @Field(() => String)
  value: string;

  @Field(() => String, { nullable: true })
  displayType?: string;
}

/**
 * Transfer Event type for NFT ownership history/provenance
 * Tracks all NFT transfers including mint, sale, and wallet-to-wallet transfers
 */
@ObjectType('TransferEvent')
export class GraphqlTransferEvent {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  fromAddress: string;

  @Field(() => String)
  toAddress: string;

  @Field(() => String)
  transactionHash: string;

  @Field(() => String)
  eventType: string; // 'mint' | 'sale' | 'transfer'

  @Field(() => String, { nullable: true })
  price?: string | null;

  @Field(() => String, { nullable: true })
  currency?: string | null;

  @Field(() => GraphQLISODateTime)
  timestamp: Date;

  @Field(() => String, { nullable: true })
  fromAddressTruncated?: string;

  @Field(() => String, { nullable: true })
  toAddressTruncated?: string;

  @Field(() => String, { nullable: true })
  blockExplorerUrl?: string;
}

/**
 * Edge type for TransferEvent connection pagination
 */
@ObjectType()
export class TransferEventEdge {
  @Field(() => GraphqlTransferEvent)
  node: GraphqlTransferEvent;

  @Field()
  cursor: string;
}

/**
 * Connection type for paginated TransferEvent queries
 */
@ObjectType()
export class TransferEventConnection {
  @Field(() => [TransferEventEdge])
  edges: TransferEventEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ObjectType('NFT')
export class GraphqlNft {
  @Field(() => ID)
  id: string;

  @Field()
  tokenId: string;

  @Field()
  contractAddress: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => [GraphqlNftAttribute])
  attributes: GraphqlNftAttribute[];

  @Field(() => ID)
  ownerId: string;

  @Field(() => ID)
  creatorId: string;

  @Field(() => ID, { nullable: true })
  collectionId?: string | null;

  @Field(() => GraphQLISODateTime)
  mintedAt: Date;

  @Field(() => String, { nullable: true })
  lastPrice?: string | null;

  @Field(() => GraphqlUserType, { nullable: true })
  owner?: GraphqlUserType | null;

  @Field(() => GraphqlUserType, { nullable: true })
  creator?: GraphqlUserType | null;

  @Field(() => GraphqlCollection, { nullable: true })
  collection?: GraphqlCollection | null;

  @Field(() => GraphqlListing, { nullable: true })
  listing?: GraphqlListing | null;

  @Field(() => [GraphqlListing], { nullable: true })
  listings?: GraphqlListing[];

  @Field(() => GraphqlAuction, { nullable: true })
  auction?: GraphqlAuction | null;

  @Field(() => GraphqlAuction, { nullable: true })
  currentAuction?: GraphqlAuction | null;

  @Field(() => [GraphqlOrder], { nullable: true })
  orders?: GraphqlOrder[];

  /**
   * Transfer history for NFT ownership provenance
   * Returns paginated list of all transfers including mint, sale, and transfers
   */
  @Field(() => TransferEventConnection, { nullable: true })
  transferHistory?: TransferEventConnection | null;

  /**
   * First transfer event (mint) - identifies the creator
   */
  @Field(() => GraphqlTransferEvent, { nullable: true })
  firstTransfer?: GraphqlTransferEvent | null;

  /**
   * Most recent transfer event - shows current owner
   */
  @Field(() => GraphqlTransferEvent, { nullable: true })
  lastTransfer?: GraphqlTransferEvent | null;
}

@ObjectType()
export class NFTEdge {
  @Field(() => GraphqlNft)
  node: GraphqlNft;

  @Field()
  cursor: string;
}

@ObjectType()
export class NFTConnection {
  @Field(() => [NFTEdge])
  edges: NFTEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}
