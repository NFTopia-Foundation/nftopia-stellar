describe('Redis Connection Failure', () => {
  beforeEach(() => {
    jest.resetModules(); // Clear module cache
    jest.clearAllMocks(); // Optional, clear mock state
  });

  it('should throw an error when Redis fails to connect', () => {
    jest.doMock('ioredis', () => {
      return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
          throw new Error('Redis connection failed');
        }),
      };
    });

    expect(() => {
      require('../src/queues/payment.queue');
    }).toThrow('Redis connection failed');
  });
});
