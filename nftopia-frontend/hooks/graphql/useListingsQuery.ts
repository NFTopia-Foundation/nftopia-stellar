import { QueryHookOptions } from "@apollo/client";
import {
  GetListingsQuery,
  GetListingsQueryVariables,
  useGetListingsQuery as useGetListingsQueryGenerated,
} from "./generated";

export function useListingsQuery(
  options?: QueryHookOptions<GetListingsQuery, GetListingsQueryVariables>
) {
  return useGetListingsQueryGenerated(options);
}
