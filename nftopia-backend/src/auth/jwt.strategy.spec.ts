import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy account state', () => {
  const configService = { get: jest.fn(() => 'test-secret') };

  it('rejects a JWT after the user has been anonymized', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1', anonymizedAt: new Date() }),
    };
    const strategy = new JwtStrategy(configService as never, userRepository as never);

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows a pending deletion account to retain access for cancellation', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1', anonymizedAt: null }),
    };
    const strategy = new JwtStrategy(configService as never, userRepository as never);

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toMatchObject({
      userId: 'user-1',
    });
  });
});
