import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { NFT } from '../nfts/entities/nft.entity';
import { NftStorageService } from '../nftstorage/nftstorage.service';
import { NotFoundException } from '@nestjs/common';

const mockTxRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
};

const mockUserRepo = {
  findOneBy: jest.fn(),
};

const mockNftRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockNftStorageService = {
  uploadToIPFS: jest.fn(),
};

jest.mock('../utils/file-type-result', () => ({
  fileTypeResultFromBuffer: jest.fn().mockResolvedValue({ ext: 'png' }),
}));

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as Response)
    ) as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: getRepositoryToken(Transaction), useValue: mockTxRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(NFT), useValue: mockNftRepo },
        { provide: NftStorageService, useValue: mockNftStorageService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should record a transaction successfully', async () => {
    const mockBuyer = { id: 'buyer123' };
    const mockNft = {
      id: 'nft123',
      title: 'Cool NFT',
      description: 'Desc',
      imageUrl: 'https://example.com/image.png',
      metadata: { attributes: [] },
      owner: {},
    };

    mockUserRepo.findOneBy.mockResolvedValue(mockBuyer);
    mockNftRepo.findOne.mockResolvedValue(mockNft);
    mockNftStorageService.uploadToIPFS.mockResolvedValue('ipfs://mock-url');
    mockTxRepo.create.mockImplementation((tx) => tx);
    mockTxRepo.save.mockImplementation((tx) => Promise.resolve(tx));
    mockNftRepo.save.mockResolvedValue(true);

    const result = await service.recordTransaction('buyer123', 'nft123', 100);

    expect(result.buyer).toEqual(mockBuyer);
    expect(result.nft).toEqual(mockNft);
    expect(result.amount).toBe(100);
    expect(mockNftStorageService.uploadToIPFS).toHaveBeenCalled();
    expect(mockTxRepo.save).toHaveBeenCalled();
  });

  it('should throw if buyer or NFT is not found', async () => {
    mockUserRepo.findOneBy.mockResolvedValue(null);
    mockNftRepo.findOne.mockResolvedValue(null);

    await expect(service.recordTransaction('invalid', 'invalid', 100)).rejects.toThrow(
      NotFoundException
    );
  });

  it('should get transactions by user', async () => {
    const txs = [{ id: 'tx1' }, { id: 'tx2' }];
    mockTxRepo.find.mockResolvedValue(txs);

    const result = await service.getTransactionsByUser('user123');

    expect(mockTxRepo.find).toHaveBeenCalledWith({
      where: { buyer: { id: 'user123' } },
      relations: ['nft'],
    });
    expect(result).toEqual(txs);
  });
});
