import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionQueryDto } from './dto/auction-query.dto';
import { AuctionStatus } from './interfaces/auction.interface';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { User } from '../../users/user.entity';
import { ConfigService } from '@nestjs/config';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionState } from '../transaction/enums/transaction-state.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { extendAuctionForLastMinuteBid } from './anti-sniping';

const DEFAULT_MIN_BID_INCREMENT = 1;

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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
    private readonly settlementClient: MarketplaceSettlementClient,
    private readonly transactionService: TransactionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createDto: CreateAuctionDto, sellerId: string) {
    const enableOnchain = this.configService.get<boolean>(
      'ENABLE_ONCHAIN_SETTLEMENT',
    );
    if (enableOnchain) {
      // Only allow 'english' or 'dutch' for auctionType
      const auctionType: 'english' | 'dutch' =
        createDto.auctionType === 'dutch' ? 'dutch' : 'english';
      const params = {
        seller: sellerId,
        nftContract: createDto.nftContractId,
        tokenId: createDto.nftTokenId,
        startPrice: String(createDto.startPrice),
        reservePrice: String(createDto.reservePrice),
        currency: createDto.currency || 'XLM',
        auctionType,
        durationSeconds:
          createDto.endTime && createDto.startTime
            ? Math.floor(
                (new Date(createDto.endTime).getTime() -
                  new Date(createDto.startTime).getTime()) /
                  1000,
              )
            : 0,
      };
      const auctionId = await this.settlementClient.createAuction(params);
      return { success: true, auctionId };
    }

    // Legacy DD logic
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
      minBidIncrement: createDto.minBidIncrement ?? null,
      minBidIncrementPercent: createDto.minBidIncrementPercent ?? null,
    });

    return this.auctionRepo.save(auction);
  }

  private getDefaultMinBidIncrement(): number {
    const configured = Number(
      this.configService.get<string | number>(
        'AUCTION_MIN_BID_INCREMENT',
        DEFAULT_MIN_BID_INCREMENT,
      ),
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MIN_BID_INCREMENT;
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

  async findByIds(ids: string[]): Promise<Auction[]> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) {
      return [];
    }

    return this.auctionRepo.find({ where: { id: In(uniqueIds) } });
  }

  async findByNFTIds(nftIds: string[]): Promise<Auction[]> {
    const uniqueNftIds = [...new Set(nftIds.filter(Boolean))];
    if (!uniqueNftIds.length) {
      return [];
    }

    const parsed = uniqueNftIds
      .map((nftId) => {
        const [contractId, tokenId] = nftId.split(':');
        if (!contractId || !tokenId) {
          return null;
        }

        return { contractId, tokenId };
      })
      .filter(
        (value): value is { contractId: string; tokenId: string } =>
          value !== null,
      );

    if (!parsed.length) {
      return [];
    }

    const qb = this.auctionRepo
      .createQueryBuilder('a')
      .where(
        new Brackets((where) => {
          parsed.forEach(({ contractId, tokenId }, index) => {
            where.orWhere(
              `(a.nftContractId = :contractId${index} AND a.nftTokenId = :tokenId${index})`,
              {
                [`contractId${index}`]: contractId,
                [`tokenId${index}`]: tokenId,
              },
            );
          });
        }),
      )
      .andWhere('a.status = :status', { status: AuctionStatus.ACTIVE })
      .andWhere('a.endTime > :now', { now: new Date() });

    return qb.getMany();
  }

  async getBids(auctionId: string) {
    return this.bidRepo.find({
      where: { auctionId },
      order: { createdAt: 'DESC' },
    });
  }

  async placeBid(auctionId: string, bidderId: string, dto: PlaceBidDto) {
    const enableOnchain = this.configService.get<boolean>(
      'ENABLE_ONCHAIN_SETTLEMENT',
    );
    if (enableOnchain) {
      // On-chain: call contract to place bid
      const result = await this.settlementClient.placeBid(
        Number(auctionId),
        bidderId,
        String(dto.amount),
      );
      return { success: true, result };
    }

    // Legacy DE logic
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.status !== AuctionStatus.ACTIVE)
      throw new BadRequestException('Auction is not active');
    const now = Date.now();
    const endTime = new Date(auction.endTime).getTime();
    if (endTime <= now)
      throw new BadRequestException('Auction expired');
    if (!auction.sellerId) {
      throw new BadRequestException('Auction seller is no longer available');
    }

    const amount = Number(dto.amount);
    const currentPrice = Number(auction.currentPrice);
    const minIncrement = this.resolveMinBidIncrement(auction, currentPrice);
    const minimumBid = currentPrice + minIncrement;

    if (amount < minimumBid) {
      throw new BadRequestException(
        `Bid must be at least ${minimumBid} (current price ${currentPrice} + minimum increment ${minIncrement})`,
      );
    }

    const bid = this.bidRepo.create({ auctionId, bidderId, amount });

    await this.bidRepo.save(bid);

    auction.currentPrice = amount;
    const extended = extendAuctionForLastMinuteBid(
      auction,
      this.configService,
      now,
    );
    await this.auctionRepo.save(auction);

    if (extended) {
      this.notificationsService.broadcastAuctionExtended(auctionId, {
        endTime: auction.endTime.toISOString(),
        extensionCount: auction.extensionCount,
      });
    }

    return bid;
  }

  private resolveMinBidIncrement(auction: Auction, currentPrice: number): number {
    if (auction.minBidIncrementPercent != null) {
      const percent = Number(auction.minBidIncrementPercent);
      if (Number.isFinite(percent) && percent > 0) {
        return currentPrice * (percent / 100);
      }
    }
    if (auction.minBidIncrement != null) {
      const fixed = Number(auction.minBidIncrement);
      if (Number.isFinite(fixed) && fixed >= 0) {
        return fixed;
      }
    }
    return this.getDefaultMinBidIncrement();
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
    if (!auction.sellerId) {
      throw new BadRequestException('Auction seller is no longer available');
    }
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

    if (!highest.bidderId) {
      auction.status = AuctionStatus.COMPLETED;
      await this.auctionRepo.save(auction);
      return {
        settled: false,
        reason: 'Winning bidder account is no longer available',
      };
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

    const transaction =
      await this.transactionService.createAndExecuteAuctionSettlement(
        auctionId,
        highest.bidderId,
        Number(highest.amount),
      );

    auction.winnerId = highest.bidderId;
    auction.currentPrice = highest.amount;
    auction.status =
      transaction.state === TransactionState.COMPLETED
        ? AuctionStatus.SETTLED
        : AuctionStatus.COMPLETED;
    await this.auctionRepo.save(auction);

    await this.notifyAuctionWon(auction, highest.bidderId, Number(highest.amount));
  }
}
