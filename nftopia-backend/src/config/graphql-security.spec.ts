import {
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  parse,
  validate,
} from 'graphql';
import { createGraphqlValidationRules } from './graphql.config';
import { paginatedComplexity } from '../graphql/complexity';

/**
 * Validates the query complexity/depth-limiting guard rails added for #649
 * against a small hand-built schema that mirrors the real shape (a
 * paginated, DataLoader-style connection field annotated with
 * `paginatedComplexity()`, plus a recursive type for the depth check) —
 * without needing the full Nest/Apollo/DB stack.
 */

const BidType = new GraphQLObjectType({
  name: 'Bid',
  fields: {
    id: { type: GraphQLID },
  },
});

const AuctionType = new GraphQLObjectType({
  name: 'Auction',
  fields: {
    id: { type: GraphQLID },
    bids: {
      type: new GraphQLList(BidType),
      args: { first: { type: GraphQLInt } },
      extensions: { complexity: paginatedComplexity() },
      resolve: () => [],
    },
  },
});

let NodeType: GraphQLObjectType;
// eslint-disable-next-line prefer-const
NodeType = new GraphQLObjectType({
  name: 'Node',
  fields: () => ({
    id: { type: GraphQLID },
    child: { type: NodeType },
  }),
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    auction: {
      type: AuctionType,
      args: { id: { type: GraphQLID } },
      resolve: () => ({ id: '1' }),
    },
    node: {
      type: NodeType,
      resolve: () => ({ id: '1' }),
    },
  },
});

const schema = new GraphQLSchema({ query: QueryType });

function validateQuery(
  query: string,
  rules: ReturnType<typeof createGraphqlValidationRules>,
) {
  return validate(schema, parse(query), rules);
}

describe('GraphQL query complexity/depth limiting (#649)', () => {
  describe('complexity budget', () => {
    it('passes a normal query within the complexity budget', () => {
      const rules = createGraphqlValidationRules({
        maxQueryDepth: 10,
        maxQueryComplexity: 1000,
      });

      const errors = validateQuery(
        `{ auction(id: "1") { id bids(first: 5) { id } } }`,
        rules,
      );

      expect(errors).toHaveLength(0);
    });

    it('rejects a query that exceeds the complexity budget with a clear error', () => {
      const rules = createGraphqlValidationRules({
        maxQueryDepth: 10,
        maxQueryComplexity: 3,
      });

      const errors = validateQuery(
        `{ auction(id: "1") { id bids(first: 50) { id } } }`,
        rules,
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toMatch(/complexity/i);
    });

    it('scales the cost of a paginated field with the requested page size', () => {
      // first: 50 costs 10x first: 5 — a budget that fits the small
      // request must reject the large one, proving the cost actually
      // scales rather than being a flat per-field constant.
      const rules = createGraphqlValidationRules({
        maxQueryDepth: 10,
        maxQueryComplexity: 10,
      });

      const smallPage = validateQuery(
        `{ auction(id: "1") { id bids(first: 5) { id } } }`,
        rules,
      );
      const largePage = validateQuery(
        `{ auction(id: "1") { id bids(first: 50) { id } } }`,
        rules,
      );

      expect(smallPage).toHaveLength(0);
      expect(largePage.length).toBeGreaterThan(0);
    });
  });

  describe('depth limit', () => {
    it('passes a normal, shallowly-nested query', () => {
      const rules = createGraphqlValidationRules({
        maxQueryDepth: 5,
        maxQueryComplexity: 1000,
      });

      const errors = validateQuery(`{ node { id child { id } } }`, rules);

      expect(errors).toHaveLength(0);
    });

    it('rejects a query that exceeds the maximum depth with a clear error', () => {
      const rules = createGraphqlValidationRules({
        maxQueryDepth: 3,
        maxQueryComplexity: 1000,
      });

      const deeplyNested = `{ node { child { child { child { child { id } } } } } }`;
      const errors = validateQuery(deeplyNested, rules);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toMatch(/depth/i);
    });
  });
});
