import type { GetListingsQuery } from "@/hooks/graphql/generated";

type ListingEdge = GetListingsQuery["listings"]["edges"][number];

function listingEdgeKey(edge: ListingEdge): string {
  return edge.node?.id || edge.cursor;
}

export function mergeListingConnection(
  previous: GetListingsQuery,
  incoming?: GetListingsQuery,
): GetListingsQuery {
  if (!incoming?.listings) {
    return previous;
  }

  const seen = new Set(previous.listings.edges.map(listingEdgeKey));
  const nextEdges = incoming.listings.edges.filter((edge) => {
    const key = listingEdgeKey(edge);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return {
    ...previous,
    listings: {
      ...incoming.listings,
      edges: [...previous.listings.edges, ...nextEdges],
    },
  };
}
