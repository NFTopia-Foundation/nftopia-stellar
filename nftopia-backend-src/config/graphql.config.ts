import type { GraphQLFormattedError } from 'graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { ApolloServerPlugin } from '@apollo/server';
import type { GraphqlContext } from '../graphql/context/context.interface';

export type GraphqlRuntimeConfig = {
  port: number;
  path: string;
  playgroundEnabled: boolean;
  introspectionEnabled: boolean;
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function getGraphqlConfig(
  env: NodeJS.ProcessEnv = process.env,
): GraphqlRuntimeConfig {
  return {
    port: parseInt(env.GRAPHQL_PORT || '3001', 10),
    path: '/graphql',
    playgroundEnabled: parseBoolean(env.GRAPHQL_PLAYGROUND_ENABLED, true),
    introspectionEnabled: parseBoolean(env.GRAPHQL_INTROSPECTION_ENABLED, true),
  };
}

export function createGraphqlLandingPagePlugin(enabled: boolean) {
  return enabled
    ? (ApolloServerPluginLandingPageLocalDefault({
        embed: true,
      }) as ApolloServerPlugin<GraphqlContext>)
    : null;
}

export function formatGraphqlError(formattedError: GraphQLFormattedError) {
  return {
    message: formattedError.message,
    code:
      typeof formattedError.extensions?.code === 'string'
        ? formattedError.extensions.code
        : 'INTERNAL_SERVER_ERROR',
    path: formattedError.path,
    timestamp: new Date().toISOString(),
  };
}
