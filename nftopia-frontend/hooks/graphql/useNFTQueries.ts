"use client";

import { ApolloError, LazyQueryHookOptions, QueryHookOptions } from "@apollo/client";
import {
  GatewayHealthQuery,
  GatewayHealthQueryVariables,
  GetNftByIdQuery,
  GetNftByIdQueryVariables,
  GetNftsQuery,
  GetNftsQueryVariables,
  useGatewayHealthQuery as useGatewayHealthQueryGenerated,
  useGetNftByIdLazyQuery,
  useGetNftByIdQuery,
  useGetNftsQuery,
} from "@/hooks/graphql/generated";

export function useGatewayHealthQuery(
  options?: QueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>
) {
  return useGatewayHealthQueryGenerated({
    fetchPolicy: "network-only",
    ...options,
  });
}

export function useNFTsQuery(
  options?: QueryHookOptions<GetNftsQuery, GetNftsQueryVariables>
) {
  return useGetNftsQuery(options);
}

export function useNFTByIdQuery(
  variables: GetNftByIdQueryVariables,
  options?: Omit<QueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>, "variables">
) {
  return useGetNftByIdQuery({
    variables,
    ...options,
  });
}

export function useLazyNFTByIdQuery(
  options?: LazyQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>
) {
  return useGetNftByIdLazyQuery(options);
}

export function mapApolloError(error?: ApolloError): string | null {
  if (!error) {
    return null;
  }

  if (error.networkError) {
    return `Network error: ${error.networkError.message}`;
  }

  if (error.graphQLErrors.length) {
    return error.graphQLErrors.map((entry) => entry.message).join("; ");
  }

  return error.message;
}

export type NftQueryVariables = GetNftsQueryVariables;
export type NftByIdVariables = GetNftByIdQueryVariables;
export type GatewayHealthResult = GatewayHealthQuery;
