import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
  split,
  NormalizedCacheObject,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3001/graphql";

function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const tokenKeys = ["auth-token", "auth_token", "token", "accessToken", "access_token"];

  for (const key of tokenKeys) {
    const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (token) {
      return token;
    }
  }

  const storedUser = window.localStorage.getItem("auth-user") || window.sessionStorage.getItem("auth-user");
  if (storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser);
      const token =
        parsedUser?.data?.token ||
        parsedUser?.token ||
        parsedUser?.accessToken ||
        parsedUser?.access_token ||
        null;

      if (token) {
        return token;
      }
    } catch {
      // Ignore malformed storage payloads.
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

  const httpLinkChain = from([errorLink, authLink, httpLink]);

  let link = httpLinkChain;

  if (typeof window !== "undefined") {
    try {
      const wsUrl =
        process.env.NEXT_PUBLIC_GRAPHQL_WS_URL ||
        GRAPHQL_URL.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");

      const wsClient = createClient({
        url: wsUrl,
        connectionParams: () => {
          const token = getAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        retryAttempts: 5,
        shouldRetry: () => true,
      });

      const wsLink = new GraphQLWsLink(wsClient);

      link = split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === "OperationDefinition" &&
            definition.operation === "subscription"
          );
        },
        wsLink,
        httpLinkChain
      );
    } catch (err) {
      console.warn("[ApolloClient] WebSocket link initialization failed, falling back to HTTP:", err);
      link = httpLinkChain;
    }
  }

  return new ApolloClient({
    link,
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
    devtools: {
      enabled: process.env.NODE_ENV !== "production",
    },
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
