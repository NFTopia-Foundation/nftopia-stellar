import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { Auction } from './entities/auction.entity';

const TEN_MINUTES_MS = 10 * 60 * 1000;

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepository: Repository<Auction>,
  ) {}

  async createAuction(dto: CreateAuctionDto): Promise<Auction> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid start_time or end_time');
    }

    if (endTime <= startTime) {
      throw new BadRequestException('end_time must be after start_time');
    }

    const startPrice = Number(dto.startPrice);
    const reservePrice = Number(dto.reservePrice);

    if (reservePrice < startPrice) {
      throw new BadRequestException(
        'reserve_price must be greater than or equal to start_price',
      );
    }

    const minBidIncrement = dto.minBidIncrement ?? '0.1000000';

    const auction = this.auctionRepository.create({
      nftContractId: dto.nftContractId,
      tokenId: dto.tokenId,
      seller: dto.seller,
      startPrice: dto.startPrice,
      reservePrice: dto.reservePrice,
      startTime,
      endTime,
      minBidIncrement,
      currentHighBid: dto.startPrice,
      currentHighBidder: null,
      isSettled: false,
      reserveMet: false,
      winnerClaimable: false,
      settledAt: null,
    });

    return this.auctionRepository.save(auction);
  }

  async placeBid(auctionId: string, dto: PlaceBidDto): Promise<Auction> {
    const auction = await this.getAuctionOrFail(auctionId);
    if (auction.isSettled) {
      throw new BadRequestException('Auction already settled');
    }

    const now = new Date();
    if (now < auction.startTime) {
      throw new BadRequestException('Auction has not started');
    }
    if (now > auction.endTime) {
      throw new BadRequestException('Auction has ended');
    }

    if (dto.bidder === auction.seller) {
      throw new BadRequestException('Seller cannot bid on own auction');
    }

    const currentHighBid = Number(auction.currentHighBid);
    const minIncrement = Number(auction.minBidIncrement);
    const minimumNextBid = currentHighBid + minIncrement;
    const newBid = Number(dto.bidAmount);

    if (newBid <= minimumNextBid) {
      throw new BadRequestException(
        `Bid must be greater than current_high_bid + min_bid_increment (${minimumNextBid.toFixed(7)})`,
      );
    }

    const previousBidder = auction.currentHighBidder;
    auction.currentHighBid = dto.bidAmount;
    auction.currentHighBidder = dto.bidder;

    const msRemaining = auction.endTime.getTime() - now.getTime();
    if (msRemaining <= TEN_MINUTES_MS) {
      auction.endTime = new Date(auction.endTime.getTime() + TEN_MINUTES_MS);
      this.logger.log(
        `Auction ${auction.id} extended by 10 minutes (anti-sniping).`,
      );
    }

    const saved = await this.auctionRepository.save(auction);

    if (previousBidder && previousBidder !== dto.bidder) {
      this.logger.warn(
        `Outbid notification: ${previousBidder} was outbid on auction ${auction.id}`,
      );
    }

    return saved;
  }

  async settleAuction(auctionId: string): Promise<Auction> {
    const auction = await this.getAuctionOrFail(auctionId);

    if (auction.isSettled) {
      return auction;
    }

    const now = new Date();
    if (now <= auction.endTime) {
      throw new BadRequestException('Auction is still active');
    }

    const hasWinner = !!auction.currentHighBidder;
    const reserveMet =
      hasWinner &&
      Number(auction.currentHighBid) >= Number(auction.reservePrice);

    auction.isSettled = true;
    auction.settledAt = now;
    auction.reserveMet = reserveMet;
    auction.winnerClaimable = reserveMet;

    const saved = await this.auctionRepository.save(auction);

    if (reserveMet) {
      this.logger.log(
        `Auction ${auction.id} settled: token ${auction.nftContractId}/${auction.tokenId} winner ${auction.currentHighBidder} at ${auction.currentHighBid}.`,
      );
    } else {
      this.logger.log(
        `Auction ${auction.id} closed without sale (reserve not met or no bidder).`,
      );
    }

    return saved;
  }

  async getAuctionById(auctionId: string): Promise<Auction> {
    return this.getAuctionOrFail(auctionId);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async settleExpiredAuctions(): Promise<void> {
    const now = new Date();
    const expired = await this.auctionRepository.find({
      where: {
        isSettled: false,
        endTime: LessThanOrEqual(now),
      },
    });

    for (const auction of expired) {
      try {
        await this.settleAuction(auction.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown settlement error';
        this.logger.error(`Failed to settle auction ${auction.id}: ${message}`);
      }
    }
  }

  private async getAuctionOrFail(auctionId: string): Promise<Auction> {
    const auction = await this.auctionRepository.findOne({
      where: { id: auctionId },
    });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }
    return auction;
  }
}
