import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bid } from './entities/bid.entity';
import { User } from '../users/entities/user.entity';
import { Auction } from '../auctions/entities/auction.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BidsService {
  constructor(
    @InjectRepository(Bid) private readonly bidRepo: Repository<Bid>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Auction) private readonly auctionRepo: Repository<Auction>,
    private readonly eventEmitter: EventEmitter2, // Replace EventsService

  ) {}

  async placeBid(userId: string, auctionId: string, amount: number): Promise<Bid> {
    const bidder = await this.userRepo.findOneBy({ id: userId });
    const auction = await this.auctionRepo.findOneBy({ id: auctionId });

    if (!bidder || !auction) throw new NotFoundException('Bidder or Auction not found');

    const bid = this.bidRepo.create({ bidder, auction, amount });
    const savedBid = await this.bidRepo.save(bid);

    this.eventEmitter.emit('bid.placed', {
      auctionId,
      bidId: savedBid.id,
      amount: savedBid.amount,
      bidderId: savedBid.bidder.id
    });

    return savedBid;
  }

  async getBidsForAuction(auctionId: string): Promise<Bid[]> {
    return this.bidRepo.find({ where: { auction: { id: auctionId } }, relations: ['bidder'] });
  }

  async getHighestBid(auctionId: string): Promise<Bid | null> {
    return this.bidRepo.createQueryBuilder('bid')
      .where('bid.auctionId = :auctionId', { auctionId })
      .orderBy('bid.amount', 'DESC')
      .leftJoinAndSelect('bid.bidder', 'user')
      .getOne();
  }
}
