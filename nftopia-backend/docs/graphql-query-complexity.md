# GraphQL query complexity/depth limiting (#649)

The GraphQL gateway (`src/main.ts`'s `bootstrapGraphqlGateway()`) rejects a
query before it executes if it is too deeply nested or too expensive,
instead of discovering the cost only after the database/DataLoader work has
already run.

Two independent guards run as Apollo Server `validationRules`
(`createGraphqlValidationRules()` in `src/config/graphql.config.ts`):

1. **Depth limit** (`graphql-depth-limit`, `GRAPHQL_MAX_QUERY_DEPTH`, default
   `10`) — a cheap, schema-shape-only secondary guard against pathological
   nesting (`__`-prefixed introspection fields are always ignored).
2. **Complexity budget** (`graphql-query-complexity`,
   `GRAPHQL_MAX_QUERY_COMPLEXITY`, default `1000`) — the primary guard. Every
   selected field has a cost; a query is rejected once the sum exceeds the
   budget.

Both produce a `GraphQLError` during validation (before any resolver runs),
which `formatGraphqlError` passes through with its message intact — the
client sees a normal GraphQL error response, not a timeout or a 500.

## The cost model

Costs are set per field via the `complexity` option NestJS's `@Query`,
`@Mutation`, and `@ResolveField` decorators already support, which — for a
code-first schema like this one — simply sets `extensions.complexity` on the
underlying `GraphQLFieldConfig`. The validation rule reads that extension
first (`fieldExtensionsEstimator()`), falling back to a flat cost of `1` for
any field that doesn't set one (`simpleEstimator({ defaultComplexity: 1 })`).

Shared helpers live in `src/graphql/complexity.ts`:

| Helper | Use for | Cost |
| --- | --- | --- |
| *(default, no annotation)* | A plain scalar/object field with no extra DB work | `1` |
| `DATALOADER_RELATION_COMPLEXITY` | A `@ResolveField` returning a single related entity via a DataLoader (e.g. `order.seller`) | `2` |
| `DATALOADER_LIST_RELATION_COMPLEXITY` | A `@ResolveField`/`@Query` returning an *unbounded* list (no page-size argument) backed by a DataLoader or direct query (e.g. `nft.orders`, `auctionBids`) | `childComplexity + 5` |
| `paginatedComplexity(defaultPageSize?)` | Any field accepting a page-size argument — `pagination.first`, `first`, or `limit` — including every GraphQL "connection" (e.g. `nfts`, `collections`, `user.listings`) | `max(childComplexity, 1) * requestedPageSize` |

`paginatedComplexity` is the one to reach for most often: it makes the cost
scale with what the caller actually asked for, so `first: 1000` on a
connection costs 1000x what `first: 1` does, rather than being flat-rate like
an unannotated field. That's what makes the budget meaningful for
pagination — without it, a client could request an arbitrarily large page at
a fixed cost.

For a one-off shape that doesn't fit any helper (e.g. a field that fans out
to several equally-sized paginated sub-queries, like
`PublicCreatorResolver.activity`), write a small inline estimator:
`({ args, childComplexity }) => ...`. Pass `node`/`context` through only if
you need them — see `ComplexityEstimatorArgs` in `@nestjs/graphql`.

## Adding a new resolver field

- A trivial field (string, number, enum, a value already on the parent
  object): leave it unannotated — default cost `1`.
- A `@ResolveField` that calls `context.loaders.X.load(...)` for a single
  entity: `complexity: DATALOADER_RELATION_COMPLEXITY`.
- A `@ResolveField`/`@Query` returning an array with no page-size argument:
  `complexity: DATALOADER_LIST_RELATION_COMPLEXITY`.
- A `@Query`/`@ResolveField` returning a connection or accepting
  `first`/`limit`: `complexity: paginatedComplexity()` (pass a different
  default page size if the field's own default isn't 20).

## Tests

`src/config/graphql-security.spec.ts` validates the rule construction itself
against a small hand-built schema (no Nest/Apollo/DB stack needed):
a normal query passes within budget, an overly complex query is rejected,
the cost actually scales with a paginated field's requested page size, a
shallow query passes the depth check, and a deeply-nested query is rejected
by it.
