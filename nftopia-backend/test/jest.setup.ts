// jest.setup.ts

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
      return {
        on: jest.fn(),
        quit: jest.fn(),
        // other Redis methods used by BullMQ internally
      };
    });
  });
  