"use client";

import { ApolloError, LazyQueryHookOptions, QueryHookOptions } from "@apollo/client";
import {
  GatewayHealthQuery,
  GatewayHealthQueryVariables,
  GetNftByIdQuery,
  GetNftByIdQueryVariables,
  GetNftsQuery,
  GetNftsQueryVariables,
  GetNftTransferHistoryQuery,
  GetNftTransferHistoryQueryVariables,
  GetNftTransferHistoryCursorQuery,
  GetNftTransferHistoryCursorQueryVariables,
  GetNftTransferEventQuery,
  GetNftTransferEventQueryVariables,
  useGatewayHealthQuery as useGatewayHealthQueryGenerated,
  useGetNftByIdLazyQuery,
  useGetNftByIdQuery,
  useGetNftsQuery,
  useGetNftTransferHistoryQuery,
  useGetNftTransferHistoryLazyQuery,
  useGetNftTransferHistoryCursorQuery,
  useGetNftTransferHistoryCursorLazyQuery,
  useGetNftTransferEventQuery,
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

/**
 * Hook to fetch NFT transfer history with pagination
 * Used for the provenance/ownership history section
 */
export function useNFTTransferHistoryQuery(
  variables: GetNftTransferHistoryQueryVariables,
  options?: Omit<QueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>, "variables">
) {
  return useGetNftTransferHistoryQuery({
    variables,
    notifyOnNetworkStatusChange: true,
    ...options,
  });
}

/**
 * Hook for lazy loading NFT transfer history
 * Useful for loading more history on demand
 */
export function useLazyNFTTransferHistoryQuery(
  options?: LazyQueryHookOptions<GetNftTransferHistoryQuery, GetNftTransferHistoryQueryVariables>
) {
  return useGetNftTransferHistoryLazyQuery({
    notifyOnNetworkStatusChange: true,
    ...options,
  });
}

/**
 * Hook to fetch NFT transfer history with cursor-based pagination
 * Ideal for infinite scroll implementation
 */
export function useNFTTransferHistoryCursorQuery(
  variables: GetNftTransferHistoryCursorQueryVariables,
  options?: Omit<QueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>, "variables">
) {
  return useGetNftTransferHistoryCursorQuery({
    variables,
    notifyOnNetworkStatusChange: true,
    ...options,
  });
}

/**
 * Hook for lazy loading NFT transfer history with cursor
 */
export function useLazyNFTTransferHistoryCursorQuery(
  options?: LazyQueryHookOptions<GetNftTransferHistoryCursorQuery, GetNftTransferHistoryCursorQueryVariables>
) {
  return useGetNftTransferHistoryCursorLazyQuery({
    notifyOnNetworkStatusChange: true,
    ...options,
  });
}

/**
 * Hook to fetch a specific transfer event by ID
 */
export function useNFTTransferEventQuery(
  variables: GetNftTransferEventQueryVariables,
  options?: Omit<QueryHookOptions<GetNftTransferEventQuery, GetNftTransferEventQueryVariables>, "variables">
) {
  return useGetNftTransferEventQuery({
    variables,
    ...options,
  });
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
export type NftTransferHistoryVariables = GetNftTransferHistoryQueryVariables;
export type NftTransferHistoryCursorVariables = GetNftTransferHistoryCursorQueryVariables;