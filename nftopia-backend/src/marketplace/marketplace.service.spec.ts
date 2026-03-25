import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionService } from './marketplace.service';

type MockRepo<T extends object = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

describe('AuctionService', () => {
  let service: AuctionService;
  let repo: MockRepo<Auction>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        {
          provide: getRepositoryToken(Auction),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
  });

  it('should reject bids that do not meet minimum increment', async () => {
    const auction = {
      id: 'a1',
      seller: 'GSELLER',
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      currentHighBid: '10.0000000',
      minBidIncrement: '1.0000000',
      currentHighBidder: 'GBIDDER0',
      isSettled: false,
    } as Auction;

    repo.findOne!.mockResolvedValue(auction);

    await expect(
      service.placeBid('a1', { bidder: 'GBIDDER1', bidAmount: '11.0000000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should accept valid bids and update high bidder', async () => {
    const auction = {
      id: 'a2',
      seller: 'GSELLER',
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      currentHighBid: '10.0000000',
      minBidIncrement: '1.0000000',
      currentHighBidder: 'GBIDDER0',
      isSettled: false,
    } as Auction;

    repo.findOne!.mockResolvedValue(auction);
    repo.save!.mockImplementation((v: Auction) => Promise.resolve(v));

    const updated = await service.placeBid('a2', {
      bidder: 'GBIDDER2',
      bidAmount: '12.0000000',
    });

    expect(updated.currentHighBid).toBe('12.0000000');
    expect(updated.currentHighBidder).toBe('GBIDDER2');
    expect(repo.save).toHaveBeenCalled();
  });

  it('should extend auction end time when bid is placed in last 10 minutes', async () => {
    const before = new Date(Date.now() + 5 * 60 * 1000);
    const auction = {
      id: 'a3',
      seller: 'GSELLER',
      startTime: new Date(Date.now() - 60_000),
      endTime: before,
      currentHighBid: '20.0000000',
      minBidIncrement: '0.5000000',
      currentHighBidder: 'GBIDDER0',
      isSettled: false,
    } as Auction;

    repo.findOne!.mockResolvedValue(auction);
    repo.save!.mockImplementation((v: Auction) => Promise.resolve(v));

    const updated = await service.placeBid('a3', {
      bidder: 'GBIDDER3',
      bidAmount: '21.0000000',
    });

    expect(updated.endTime.getTime()).toBeGreaterThan(before.getTime());
    expect(updated.endTime.getTime()).toBe(before.getTime() + 10 * 60 * 1000);
  });
});
