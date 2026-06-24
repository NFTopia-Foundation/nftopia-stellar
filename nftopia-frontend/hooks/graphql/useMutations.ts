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