import { ListingCreatedListener } from './listing-created.listener';
import {
  MODERATE_LISTING_JOB,
  ListingCreatedEvent,
} from './ai-moderation.types';

describe('ListingCreatedListener', () => {
  let listener: ListingCreatedListener;
  const moderationQueue = { add: jest.fn() };

  const event: ListingCreatedEvent = {
    listingId: 'listing-1',
    sellerId: 'seller-1',
    nftContractId: 'C1',
    nftTokenId: '1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new ListingCreatedListener(moderationQueue as never);
  });

  it('enqueues a moderation job with the listing identifying fields', async () => {
    moderationQueue.add.mockResolvedValue({ id: 'job-1' });

    await listener.handleListingCreated(event);

    expect(moderationQueue.add).toHaveBeenCalledWith(
      MODERATE_LISTING_JOB,
      event,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
  });

  it('does not throw when the queue add rejects', async () => {
    moderationQueue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(listener.handleListingCreated(event)).resolves.toBeUndefined();
  });
});
