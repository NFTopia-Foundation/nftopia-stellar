import { Test, TestingModule } from '@nestjs/testing';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';
import type { Request as ExpressRequest } from 'express';

type AuthenticatedRequest = ExpressRequest & {
  user?: { userId?: string };
};

const createAuthRequest = (userId: string): AuthenticatedRequest =>
  ({ user: { userId } }) as AuthenticatedRequest;

const mockNftService = {
  findAll: jest.fn().mockResolvedValue({
    data: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  }),
  findById: jest.fn().mockResolvedValue({ id: 'nft-1' }),
  findByTokenId: jest
    .fn()
    .mockResolvedValue({ id: 'nft-1', tokenId: 'token-1' }),
  findByOwner: jest.fn().mockResolvedValue({ data: [] }),
  findByCollection: jest.fn().mockResolvedValue({ data: [] }),
  mint: jest.fn().mockResolvedValue({ id: 'nft-1' }),
  update: jest.fn().mockResolvedValue({ id: 'nft-1', name: 'Updated' }),
  burn: jest.fn().mockResolvedValue({ id: 'nft-1', isBurned: true }),
  getAttributes: jest.fn().mockResolvedValue([]),
};

describe('NftController', () => {
  let controller: NftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NftController],
      providers: [
        {
          provide: NftService,
          useValue: mockNftService,
        },
      ],
    }).compile();

    controller = module.get<NftController>(NftController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists nfts', async () => {
    await controller.findAll({ page: 1, limit: 20 });
    expect(mockNftService.findAll).toHaveBeenCalled();
  });

  it('gets nft by id', async () => {
    const res = await controller.findById('nft-1');
    expect(res.id).toBe('nft-1');
    expect(mockNftService.findById).toHaveBeenCalledWith('nft-1');
  });

  it('gets nft by token id', async () => {
    const res = await controller.findByTokenId('token-1');
    expect(res.tokenId).toBe('token-1');
    expect(mockNftService.findByTokenId).toHaveBeenCalledWith('token-1');
  });

  it('gets nft attributes', async () => {
    await controller.getAttributes('nft-1');
    expect(mockNftService.getAttributes).toHaveBeenCalledWith('nft-1');
  });

  it('mints nft for authenticated caller', async () => {
    await controller.mint(
      {
        tokenId: 'token-1',
        contractAddress: 'C'.repeat(56),
        name: 'Mintable',
        ownerId: '11111111-1111-1111-1111-111111111111',
        creatorId: '11111111-1111-1111-1111-111111111111',
      },
      createAuthRequest('11111111-1111-1111-1111-111111111111'),
    );

    expect(mockNftService.mint).toHaveBeenCalled();
  });

  it('updates nft metadata', async () => {
    await controller.update(
      'nft-1',
      { name: 'Updated' },
      createAuthRequest('11111111-1111-1111-1111-111111111111'),
    );

    expect(mockNftService.update).toHaveBeenCalled();
  });

  it('burns nft', async () => {
    await controller.burn(
      'nft-1',
      createAuthRequest('11111111-1111-1111-1111-111111111111'),
    );

    expect(mockNftService.burn).toHaveBeenCalledWith(
      'nft-1',
      '11111111-1111-1111-1111-111111111111',
    );
  });
});
