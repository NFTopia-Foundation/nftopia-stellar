import type { GraphQLFormattedError, ValidationRule } from 'graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { ApolloServerPlugin } from '@apollo/server';
import depthLimit from 'graphql-depth-limit';
import {
  createComplexityRule,
  fieldExtensionsEstimator,
  simpleEstimator,
} from 'graphql-query-complexity';
import type { GraphqlContext } from '../graphql/context/context.interface';

export type GraphqlRuntimeConfig = {
  port: number;
  path: string;
  playgroundEnabled: boolean;
  introspectionEnabled: boolean;
  maxQueryDepth: number;
  maxQueryComplexity: number;
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
    maxQueryDepth: parseInt(env.GRAPHQL_MAX_QUERY_DEPTH || '10', 10),
    maxQueryComplexity: parseInt(
      env.GRAPHQL_MAX_QUERY_COMPLEXITY || '1000',
      10,
    ),
  };
}

/**
 * Validation rules enforcing the query-complexity/depth-limiting guard rails
 * from #649: a depth limit as a cheap, schema-shape-only secondary guard,
 * plus a complexity budget that accounts for per-field costs (see
 * src/graphql/complexity.ts and docs/graphql-query-complexity.md) so a
 * deeply-nested or highly fanned-out query is rejected before it executes
 * rather than after it has already consumed backend resources.
 */
export function createGraphqlValidationRules(
  config: Pick<GraphqlRuntimeConfig, 'maxQueryDepth' | 'maxQueryComplexity'>,
): ValidationRule[] {
  return [
    depthLimit(config.maxQueryDepth) as ValidationRule,
    createComplexityRule({
      maximumComplexity: config.maxQueryComplexity,
      estimators: [
        fieldExtensionsEstimator(),
        simpleEstimator({ defaultComplexity: 1 }),
      ],
    }),
  ];
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
