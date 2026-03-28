"use client";

import { LazyQueryHookOptions, QueryHookOptions } from "@apollo/client";
import {
  GetCurrentUserQuery,
  GetCurrentUserQueryVariables,
  GetUserByIdQuery,
  GetUserByIdQueryVariables,
  useGetCurrentUserQuery,
  useGetUserByIdLazyQuery,
  useGetUserByIdQuery,
} from "@/hooks/graphql/generated";

export function useCurrentUserQuery(
  options?: QueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>
) {
  return useGetCurrentUserQuery(options);
}

export function useUserByIdQuery(
  variables: GetUserByIdQueryVariables,
  options?: Omit<QueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>, "variables">
) {
  return useGetUserByIdQuery({
    variables,
    ...options,
  });
}

export function useLazyUserByIdQuery(
  options?: LazyQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>
) {
  return useGetUserByIdLazyQuery(options);
}

export type UserByIdVariables = GetUserByIdQueryVariables;
