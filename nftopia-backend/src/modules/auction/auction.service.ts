import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { AuctionStatus } from './interfaces/auction.interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(StellarNft)
    private readonly nftRepo: Repository<StellarNft>,
  ) {}

  async create(createDto: CreateAuctionDto, sellerId: string) {
    const {
      nftContractId,
      nftTokenId,
      startPrice,
      reservePrice,
      startTime,
      endTime,
    } = createDto;

    // Prevent duplicate active auctions for same NFT
    const existing = await this.auctionRepo.findOne({
      where: { nftContractId, nftTokenId, status: AuctionStatus.ACTIVE },
    });
    if (existing)
      throw new BadRequestException('NFT already in active auction');

    // Ensure NFT exists
    const nft = await this.nftRepo.findOne({
      where: { contractId: nftContractId, tokenId: nftTokenId },
    });
    if (!nft) throw new NotFoundException('NFT not found');

    const now = new Date();
    const auction = this.auctionRepo.create({
      nftContractId,
      nftTokenId,
      sellerId,
      startPrice,
      currentPrice: startPrice,
      reservePrice,
      startTime: startTime ? new Date(startTime) : now,
      endTime: new Date(endTime),
      status: AuctionStatus.ACTIVE,
    });

    return this.auctionRepo.save(auction);
  }

  async findAll(query: AuctionQueryDto) {
    const qb = this.auctionRepo.createQueryBuilder('a');
    if (query.status)
      qb.andWhere('a.status = :status', { status: query.status });
    if (query.sellerId)
      qb.andWhere('a.sellerId = :sellerId', { sellerId: query.sellerId });
    if (query.nftContractId)
      qb.andWhere('a.nftContractId = :nftContractId', {
        nftContractId: query.nftContractId,
      });
    if (query.nftTokenId)
      qb.andWhere('a.nftTokenId = :nftTokenId', {
        nftTokenId: query.nftTokenId,
      });

    // Active auctions should be non-expired
    if (query.status === AuctionStatus.ACTIVE || !query.status) {
      qb.andWhere('a.endTime > :now', { now: new Date() });
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getMany();
  }

  async findOne(id: string) {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) throw new NotFoundException('Auction not found');
    return auction;
  }

  async getBids(auctionId: string) {
    return this.bidRepo.find({
      where: { auctionId },
      order: { createdAt: 'DESC' },
    });
  }

  async placeBid(auctionId: string, bidderId: string, dto: PlaceBidDto) {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.ACTIVE)
      throw new BadRequestException('Auction is not active');
    if (new Date(auction.endTime) <= new Date())
      throw new BadRequestException('Auction expired');

    const amount = dto.amount;
    if (amount <= Number(auction.currentPrice))
      throw new BadRequestException('Bid must be greater than current price');

    const bid = this.bidRepo.create({ auctionId, bidderId, amount });

    await this.bidRepo.save(bid);

    auction.currentPrice = amount;
    await this.auctionRepo.save(auction);

    return bid;
  }

  async cancelAuction(auctionId: string, callerId: string) {
    const auction = await this.findOne(auctionId);
    if (auction.sellerId !== callerId)
      throw new ForbiddenException('Only seller can cancel');
    if (auction.status !== AuctionStatus.ACTIVE)
      throw new BadRequestException('Auction not active');

    auction.status = AuctionStatus.CANCELLED;
    return this.auctionRepo.save(auction);
  }

  async settleAuction(auctionId: string, callerId?: string) {
    const auction = await this.findOne(auctionId);
    if (auction.status !== AuctionStatus.ACTIVE)
      throw new BadRequestException('Auction not active');
    const now = new Date();
    if (
      now < new Date(auction.endTime) &&
      callerId &&
      callerId !== auction.sellerId
    ) {
      throw new ForbiddenException(
        'Only seller or admin can settle before end',
      );
    }

    const highest = await this.bidRepo.findOne({
      where: { auctionId },
      order: { amount: 'DESC' },
    });

    if (!highest) {
      // No bids — mark completed
      auction.status = AuctionStatus.COMPLETED;
      await this.auctionRepo.save(auction);
      return { settled: false, reason: 'No bids' };
    }

    // Reserve enforcement
    if (
      auction.reservePrice &&
      Number(highest.amount) < Number(auction.reservePrice)
    ) {
      auction.status = AuctionStatus.COMPLETED;
      await this.auctionRepo.save(auction);
      return { settled: false, reason: 'Reserve not met' };
    }

    // Transfer NFT ownership off-chain in DB; on-chain transfer should be performed separately
    const nft = await this.nftRepo.findOne({
      where: { contractId: auction.nftContractId, tokenId: auction.nftTokenId },
    });
    if (nft) {
      nft.owner =
        (highest.bidder && highest.bidder.address) || highest.bidderId;
      await this.nftRepo.save(nft);
    }

    auction.winnerId = highest.bidderId;
    auction.currentPrice = highest.amount;
    auction.status = AuctionStatus.SETTLED;
    await this.auctionRepo.save(auction);

    // Mock on-chain settlement hook (placeholder for Soroban integration).
    // This uses a mock contract id for future on-chain implementation.
    const onchainResult = await this.performOnChainSettlement(auction, highest);

    return {
      settled: true,
      winner: highest.bidderId,
      amount: highest.amount,
      onchain: onchainResult,
    };
  }

  private async performOnChainSettlement(auction: Auction, highest: Bid) {
    // Placeholder: call to Soroban contract would happen here.
    const MOCK_CONTRACT_ID =
      process.env.MOCK_AUCTION_CONTRACT_ID || 'MOCK_CONTRACT_ID';
    this.logger.debug(
      `Performing mock on-chain settlement for auction ${auction?.id ?? 'unknown'} winner ${highest?.bidderId ?? 'unknown'} using contract ${MOCK_CONTRACT_ID}`,
    );
    // Small await to satisfy lint rule requiring async functions to have an await.
    await Promise.resolve(true);
    return { contractId: MOCK_CONTRACT_ID, txHash: null };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredAuctions() {
    this.logger.debug('Checking for expired auctions to settle');
    const now = new Date();
    const expired = await this.auctionRepo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AuctionStatus.ACTIVE })
      .andWhere('a.endTime <= :now', { now })
      .getMany();
    for (const a of expired) {
      try {
        await this.settleAuction(a.id);
      } catch (e) {
        this.logger.error(
          `Failed to settle auction ${a.id}: ${(e as Error).message}`,
        );
      }
    }
  }
}
