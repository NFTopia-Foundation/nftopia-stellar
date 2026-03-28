export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
  graphqlUrl:
    process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3001/graphql",
}
