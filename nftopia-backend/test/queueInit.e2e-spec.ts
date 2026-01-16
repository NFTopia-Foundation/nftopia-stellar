jest.unmock('ioredis');

describe('Queue Initialization', () => {
  beforeEach(() => {
    jest.resetModules(); // Clear the module cache before each test
    jest.clearAllMocks()
  });

  it('should initialize payment queue', async () => {
    try {
      const { paymentQueue } = require('../src/queues/payment.queue');
      const isReady = await paymentQueue.waitUntilReady();
      expect(isReady).toBeDefined();
    } catch (err) {
      console.error('Queue failed to initialize:', err);
      throw err; // re-throw so Jest fails the test
    }
  });
  

  it('should initialize notifications queue', async () => {
    const { notificationsQueue } = require('../src/queues/notifications.queue');
    const isReady = await notificationsQueue.waitUntilReady();
    expect(isReady).toBeDefined();
  });

  it('should initialize onchain queue', async () => {
    const { onchainQueue } = require('../src/queues/onchain.queue');
    const isReady = await onchainQueue.waitUntilReady();
    expect(isReady).toBeDefined();
  });
});
