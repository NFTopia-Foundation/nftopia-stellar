"use client";

import {
  MutationHookOptions,
  MutationTuple,
  OperationVariables,
  TypedDocumentNode,
  useMutation,
} from "@apollo/client";
import {
  CreateListingMutation,
  CreateListingMutationVariables,
  useCreateListingMutation as useCreateListingMutationGenerated,
} from "@/hooks/graphql/generated";
import { PLACE_BID_MUTATION } from "@/lib/graphql/queries/auction.queries";
import { BUY_NFT_MUTATION } from "@/lib/graphql/queries/listing.queries";
import type { PlaceBidMutation, PlaceBidMutationVariables, BuyNftMutation, BuyNftMutationVariables } from "./generated";

export function useGraphQLMutation<
  TData = Record<string, unknown>,
  TVariables extends OperationVariables = OperationVariables
>(
  document: TypedDocumentNode<TData, TVariables>,
  options?: MutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  return useMutation<TData, TVariables>(document, options);
}

export function useCreateListingMutation(
  options?: MutationHookOptions<
    CreateListingMutation,
    CreateListingMutationVariables
  >
) {
  return useCreateListingMutationGenerated(options);
}

/**
 * Hook to place a bid on an auction
 * Uses the PLACE_BID_MUTATION GraphQL mutation
 */
export function usePlaceBidMutation(
  options?: MutationHookOptions<
    PlaceBidMutation,
    PlaceBidMutationVariables
  >
) {
  return useMutation<PlaceBidMutation, PlaceBidMutationVariables>(
    PLACE_BID_MUTATION,
    options,
  );
}

/**
 * Hook to buy an NFT directly (fixed price listing)
 */
export function useBuyNFTMutation(
  options?: MutationHookOptions<
    BuyNftMutation,
    BuyNftMutationVariables
  >
) {
  return useMutation<BuyNftMutation, BuyNftMutationVariables>(
    BUY_NFT_MUTATION,
    options,
  );
}