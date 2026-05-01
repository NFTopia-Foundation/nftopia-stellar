import { NotFoundException } from '@nestjs/common';
import { UserResolver } from './user.resolver';

describe('UserResolver', () => {
  it('returns a user via DataLoader', async () => {
    const resolver = new UserResolver();
    const result = await resolver.user('user-1', {
      req: {} as never,
      res: {} as never,
      loaders: {
        userById: {
          load: jest.fn().mockResolvedValue({
            id: 'user-1',
            username: 'seyi',
            email: 'seyi@example.com',
            walletAddress: 'GABC',
          }),
        },
      } as never,
    });

    expect(result.id).toBe('user-1');
    expect(result.username).toBe('seyi');
  });

  it('throws when user is missing', async () => {
    const resolver = new UserResolver();

    await expect(
      resolver.user('missing', {
        req: {} as never,
        res: {} as never,
        loaders: {
          userById: {
            load: jest.fn().mockResolvedValue(null),
          },
        } as never,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
