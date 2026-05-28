# GraphQL DataLoader Benchmark Notes

## Scenario
- Query: `nfts(first: 20)` with nested `owner`, `creator`, `collection`, `listing`, `auction`, and `orders` fields.
- Environment: local PostgreSQL with gateway running in development mode.

## Before DataLoader
- Pattern: one query for base NFT list + one query per nested field per row.
- Typical query count: 41+ queries for owner/collection/listing combinations.

## After DataLoader
- Pattern: one base query + batched loader queries per relationship type.
- Typical query count: under 10 queries for common nested requests.

## Notes
- Loaders are request-scoped and created in GraphQL context factory.
- DataLoader cache is scoped to a single request lifecycle, preventing stale cross-request reads.
- Highest impact occurs on large connection queries with repeated relationship resolution.
