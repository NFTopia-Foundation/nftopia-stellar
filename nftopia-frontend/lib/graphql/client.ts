import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
  NormalizedCacheObject,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3001/graphql";

function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const tokenKeys = ["auth-token", "auth_token", "token", "accessToken"];

  for (const key of tokenKeys) {
    const token = window.localStorage.getItem(key);
    if (token) {
      return token;
    }
  }

  const storedUser = window.localStorage.getItem("auth-user");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      const token =
        parsedUser?.data?.token ||
        parsedUser?.token ||
        parsedUser?.accessToken ||
        null;

      if (token) {
        return token;
      }
    } catch {
      // Ignore malformed localStorage payloads.
    }
  }

  return null;
}

export function createApolloClient(): ApolloClient<NormalizedCacheObject> {
  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach((error) => {
        console.error(
          `[GraphQL error][${operation.operationName}]: ${error.message}`
        );
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`);
    }
  });

  const authLink = setContext((_, { headers }) => {
    const token = getAuthToken();

    return {
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const httpLink = new HttpLink({
    uri: GRAPHQL_URL,
    credentials: "include",
  });

  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            nfts: {
              keyArgs: ["filters", "page", "limit"],
              merge: false,
            },
            collections: {
              keyArgs: ["filters", "page", "limit"],
              merge: false,
            },
            listings: {
              keyArgs: ["filters", "page", "limit"],
              merge: false,
            },
            auctions: {
              keyArgs: ["filters", "page", "limit"],
              merge: false,
            },
          },
        },
      },
    }),
    connectToDevTools: process.env.NODE_ENV !== "production",
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
        fetchPolicy: "cache-and-network",
      },
      query: {
        errorPolicy: "all",
      },
      mutate: {
        errorPolicy: "all",
      },
    },
  });
}

let apolloClient: ApolloClient<NormalizedCacheObject> | null = null;

export function getApolloClient(): ApolloClient<NormalizedCacheObject> {
  if (!apolloClient) {
    apolloClient = createApolloClient();
  }

  return apolloClient;
}
