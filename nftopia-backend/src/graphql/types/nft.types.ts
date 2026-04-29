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
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  startCursor?: string;

  @Field(() => String, { nullable: true })
  endCursor?: string;
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
