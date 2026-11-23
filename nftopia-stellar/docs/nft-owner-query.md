# NFT Owner Token Query

`tokens_of_owner(owner, cursor, limit)` returns a bounded page of token IDs currently owned by an address, together with an optional cursor for the next page.

- `owner`: address whose tokens are queried.
- `cursor`: `None` starts at the first token. Pass the prior page's returned cursor as `Some(token_id)` to continue; the cursor token is excluded from the next page.
- `limit`: number of token IDs to return, from 1 through 50.
- Return value: `(token_ids, next_cursor)`. `next_cursor` is `Some(last_token_id)` only when more tokens remain; otherwise it is `None`.

Example: request `(owner, None, 20)`, then while `next_cursor` is present request `(owner, Some(next_cursor), 20)`. An empty owner returns an empty list and `None`. The cursor token must still be owned by the queried address when the next request is made; a transfer or burn of that token invalidates the cursor and returns `InvalidPaginationCursor`. Invalid limits return `InvalidPaginationLimit`.

The query reads a per-owner linked index, so reading a page is bounded by `limit` rather than scanning all minted tokens. Token order is not a stable sorting contract; clients should use the returned cursor rather than deriving one from token IDs.