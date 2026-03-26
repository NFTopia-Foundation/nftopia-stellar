import { Test, TestingModule } from '@nestjs/testing';
import { AuctionService } from './auction.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { AuctionStatus } from './interfaces/auction.interface';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';

const mockAuctionRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest
    .fn()
    .mockImplementation((dto: Partial<Auction>) => dto as unknown as Auction),
  save: jest.fn().mockImplementation((a: Auction) => Promise.resolve(a)),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
};

const mockBidRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest
    .fn()
    .mockImplementation((dto: Partial<Bid>) => dto as unknown as Bid),
  save: jest.fn().mockResolvedValue(undefined),
};

const mockNftRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
};

describe('AuctionService', () => {
  let service: AuctionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        { provide: getRepositoryToken(Auction), useValue: mockAuctionRepo },
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an auction', async () => {
    mockAuctionRepo.findOne.mockResolvedValueOnce(null);
    mockNftRepo.findOne.mockResolvedValueOnce({
      contractId: 'C',
      tokenId: 'T',
    });

    const dto = {
      nftContractId: 'C',
      nftTokenId: 'T',
      startPrice: 1,
      endTime: new Date().toISOString(),
    } as unknown as CreateAuctionDto;

    const result = await service.create(dto, 'seller-1');
    expect(mockAuctionRepo.create).toHaveBeenCalled();
    expect(mockAuctionRepo.save).toHaveBeenCalled();
    expect(result.sellerId).toBe('seller-1');
  });

  it('prevents duplicate active auction', async () => {
    mockAuctionRepo.findOne.mockResolvedValueOnce({ id: 'exists' });
    await expect(
      service.create(
        {
          nftContractId: 'C',
          nftTokenId: 'T',
          startPrice: 1,
          endTime: new Date().toISOString(),
        } as unknown as CreateAuctionDto,
        's',
      ),
    ).rejects.toThrow();
  });

  it('places a bid and updates current price', async () => {
    const auction = {
      id: 'a1',
      status: AuctionStatus.ACTIVE,
      endTime: new Date(Date.now() + 10000),
      currentPrice: 1,
    } as unknown as Auction;
    mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
    const dto = { amount: 2 } as unknown as PlaceBidDto;
    const bid = await service.placeBid('a1', 'b1', dto);
    expect(mockBidRepo.save).toHaveBeenCalled();
    expect(mockAuctionRepo.save).toHaveBeenCalled();
    expect(bid.amount).toBe(2);
  });

  it('rejects low bids', async () => {
    const auction = {
      id: 'a1',
      status: AuctionStatus.ACTIVE,
      endTime: new Date(Date.now() + 10000),
      currentPrice: 5,
    } as unknown as Auction;
    mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
    await expect(
      service.placeBid('a1', 'b1', { amount: 3 } as unknown as PlaceBidDto),
    ).rejects.toThrow();
  });

  it('cancels only by seller', async () => {
    const auction = {
      id: 'a1',
      sellerId: 's1',
      status: AuctionStatus.ACTIVE,
    } as unknown as Auction;
    // ensure findOne returns the auction for both calls
    mockAuctionRepo.findOne.mockResolvedValue(auction);
    await expect(service.cancelAuction('a1', 'other')).rejects.toThrow();
    await expect(service.cancelAuction('a1', 's1')).resolves.toBeDefined();
  });

  it('settles with no bids', async () => {
    const auction = {
      id: 'a1',
      status: AuctionStatus.ACTIVE,
      endTime: new Date(Date.now() - 1000),
    } as unknown as Auction;
    mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
    mockBidRepo.findOne.mockResolvedValueOnce(null);
    const res = await service.settleAuction('a1');
    expect(res.settled).toBe(false);
  });

  it('settles when reserve not met', async () => {
    const auction = {
      id: 'a1',
      status: AuctionStatus.ACTIVE,
      reservePrice: 10,
      endTime: new Date(Date.now() - 1000),
    } as unknown as Auction;
    mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
    mockBidRepo.findOne.mockResolvedValueOnce({
      bidderId: 'b1',
      amount: 5,
    } as any);
    const res = await service.settleAuction('a1');
    expect(res.settled).toBe(false);
  });

  it('successful settle updates nft owner', async () => {
    const auction = {
      id: 'a1',
      status: AuctionStatus.ACTIVE,
      endTime: new Date(Date.now() - 1000),
      nftContractId: 'C',
      nftTokenId: 'T',
    } as unknown as Auction;
    mockAuctionRepo.findOne.mockResolvedValueOnce(auction);
    // include a bidder object to simulate relation
    mockBidRepo.findOne.mockResolvedValueOnce({
      bidderId: 'b1',
      amount: 20,
      bidder: { address: 'addr1' },
    } as unknown as Bid);
    mockNftRepo.findOne.mockResolvedValueOnce({
      contractId: 'C',
      tokenId: 'T',
      owner: 'old',
    } as unknown as StellarNft);
    const res = await service.settleAuction('a1');
    expect(res.settled).toBe(true);
    expect(mockNftRepo.save).toHaveBeenCalled();
  });
});
