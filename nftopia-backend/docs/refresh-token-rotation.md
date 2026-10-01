# Refresh token rotation

The auth module uses database-backed refresh-token rotation.

## Lifecycle

- Each successful login or completed 2FA challenge creates a new refresh-token family.
- The issued refresh token contains a unique JWT ID (jti) and its family ID.
- Every successful /auth/refresh request consumes the presented refresh token and issues a new refresh token in the same family.
- Refresh tokens are stored as SHA-256 hashes rather than raw token values.
- Refresh-token rows record their expiry and whether they have been consumed or revoked.

## Reuse detection

A refresh token may be used exactly once. If a token that has already been consumed is presented again while its family is active, the entire family is revoked.

Revoking the family invalidates previously issued descendant tokens as well. Once the family is revoked, it cannot issue another access token. The user must authenticate again, which starts a new family.

An invalid token hash does not by itself revoke a family because it does not prove that a legitimate refresh token was reused.

## Expiry

Refresh-token JWT expiry and the database expiry timestamp use JWT_REFRESH_EXPIRES_IN_SECONDS, which defaults to 7 days. Expired tokens cannot be rotated.

## Concurrency

Refresh-token consumption is performed inside a PostgreSQL transaction with a pessimistic write lock on the refresh-token row. This prevents two concurrent refresh requests from successfully consuming the same token.
