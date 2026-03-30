import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from './user.resolver';
import { UsersService } from '../../users/users.service';

const mockUsersService = {
  findById: jest.fn(),
  findByAddress: jest.fn(),
};

const baseUser = {
  id: 'user-1',
  address: 'GABC123',
  email: 'test@example.com',
  username: 'stellardev',
  bio: 'Building on Stellar',
  avatarUrl: 'https://example.com/avatar.png',
  walletAddress: 'GABC123',
  walletPublicKey: null,
  walletProvider: null,
  walletConnectedAt: null,
  isEmailVerified: true,
  lastLoginAt: new Date('2026-03-20T10:00:00.000Z'),
  passwordHash: null,
  wallets: [],
};

describe('UserResolver', () => {
  let resolver: UserResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    jest.clearAllMocks();
  });

  it('returns a user by id', async () => {
    mockUsersService.findById.mockResolvedValue(baseUser);

    const result = await resolver.user('user-1');

    expect(mockUsersService.findById).toHaveBeenCalledWith('user-1');
    expect(result.id).toBe('user-1');
    expect(result.username).toBe('stellardev');
    expect(result.isEmailVerified).toBe(true);
  });

  it('throws NotFoundException when user not found by id', async () => {
    mockUsersService.findById.mockResolvedValue(null);

    await expect(resolver.user('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('returns a user by Stellar address', async () => {
    mockUsersService.findByAddress.mockResolvedValue(baseUser);

    const result = await resolver.userByAddress('GABC123');

    expect(mockUsersService.findByAddress).toHaveBeenCalledWith('GABC123');
    expect(result.address).toBe('GABC123');
  });

  it('throws NotFoundException when address not found', async () => {
    mockUsersService.findByAddress.mockResolvedValue(null);

    await expect(resolver.userByAddress('GNONE')).rejects.toThrow(NotFoundException);
  });
});
