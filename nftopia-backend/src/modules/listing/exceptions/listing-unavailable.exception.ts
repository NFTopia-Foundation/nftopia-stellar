import { ConflictException } from '@nestjs/common';

/**
 * Stable, machine-readable error code returned to the losing buyer of a
 * concurrent purchase. Clients should branch on this instead of on the
 * human-readable message.
 */
export const LISTING_UNAVAILABLE_CODE = 'LISTING_UNAVAILABLE';

/** Why a listing could not be claimed for purchase. */
export enum ListingUnavailableReason {
  /** Status is something other than ACTIVE (already SOLD/CANCELLED/EXPIRED). */
  NOT_ACTIVE = 'NOT_ACTIVE',
  /** Another buyer holds the in-flight purchase reservation. */
  RESERVED = 'RESERVED',
  /** `expiresAt` has passed. */
  EXPIRED = 'EXPIRED',
}

/**
 * Thrown when the availability check inside the purchase-claim transaction
 * fails, i.e. the buyer lost the race or the listing is otherwise not
 * purchasable.
 *
 * Distinct from a generic failure: it is a 409 with a stable `code` and a
 * `reason` so the UI can render an explicit "this listing is no longer
 * available" state rather than a generic error toast.
 */
export class ListingUnavailableException extends ConflictException {
  readonly code = LISTING_UNAVAILABLE_CODE;
  readonly reason: ListingUnavailableReason;
  readonly listingId: string;

  constructor(
    listingId: string,
    reason: ListingUnavailableReason,
    detail?: string,
  ) {
    super({
      statusCode: 409,
      error: 'Conflict',
      code: LISTING_UNAVAILABLE_CODE,
      reason,
      listingId,
      message:
        `Listing ${listingId} is no longer available (${reason})` +
        (detail ? `: ${detail}` : ''),
    });
    this.reason = reason;
    this.listingId = listingId;
  }
}
