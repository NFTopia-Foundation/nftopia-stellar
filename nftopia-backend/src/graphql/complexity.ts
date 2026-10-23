import type { Complexity, ComplexityEstimatorArgs } from '@nestjs/graphql';

/**
 * Shared complexity costs for GraphQL fields (#649). Every field defaults to
 * a complexity of 1 unless annotated otherwise (see
 * docs/graphql-query-complexity.md for the full cost model and when to use
 * each helper when adding a new resolver).
 */

/** A `@ResolveField` that loads a single related entity via a DataLoader. */
export const DATALOADER_RELATION_COMPLEXITY: Complexity = 2;

/**
 * A `@ResolveField` that loads an *unbounded* list of related entities via a
 * DataLoader (no pagination argument — e.g. "all orders for this NFT").
 * Flat additive cost on top of the selected sub-fields, since the list size
 * isn't caller-controlled.
 */
export const DATALOADER_LIST_RELATION_COMPLEXITY: Complexity = ({
  childComplexity,
}: ComplexityEstimatorArgs) => childComplexity + 5;

type PaginationArgs = {
  pagination?: { first?: number };
  first?: number;
  limit?: number;
};

/**
 * A paginated `@Query`/`@ResolveField` (a GraphQL "connection", or any field
 * taking a page-size argument). Cost scales linearly with the requested page
 * size so a large `first`/`limit` combined with expensive nested selections
 * is penalized proportionally, rather than being flat-rate like a normal
 * field — otherwise a query could request thousands of rows at a fixed cost.
 */
export function paginatedComplexity(
  defaultPageSize = 20,
): (options: ComplexityEstimatorArgs) => number {
  return ({ args, childComplexity }: ComplexityEstimatorArgs) => {
    const typedArgs = args as PaginationArgs;
    const requested =
      typedArgs?.pagination?.first ?? typedArgs?.first ?? typedArgs?.limit;
    const pageSize =
      Number.isFinite(requested) && Number(requested) > 0
        ? Number(requested)
        : defaultPageSize;

    return Math.max(childComplexity, 1) * pageSize;
  };
}
