import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFloat,
} from 'graphql';

export const AuctionType = new GraphQLObjectType({
  name: 'Auction',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLString) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    currentBid: { type: new GraphQLNonNull(GraphQLFloat) },
    // Highlighted Change: Add endTime as an ISO-8601 string or numeric timestamp string
    endTime: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

// Explicitly add a root query parameter or utility payload to fetch server time
export const ServerTimeQuery = {
  type: new GraphQLNonNull(GraphQLString),
  resolve: () => new Date().toISOString(),
};
