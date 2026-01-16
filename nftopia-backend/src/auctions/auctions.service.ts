// auctions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { NFT } from '../nfts/entities/nft.entity';
import { LessThan, MoreThan } from 'typeorm';


@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(NFT)
    private readonly nftRepo: Repository<NFT>,
  ) {}

  async createAuction(nftId: string, startTime: Date, endTime: Date): Promise<Auction> {
    const nft = await this.nftRepo.findOneBy({ id: nftId });
    if (!nft) throw new NotFoundException('NFT not found');

    const auction = this.auctionRepo.create({ nft, startTime, endTime });
    return this.auctionRepo.save(auction);
  }

  async getAuction(id: string): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({ where: { id }, relations: ['nft'] });
    if (!auction) throw new NotFoundException('Auction not found');
    return auction;
  }

  async getActiveAuctions(): Promise<Auction[]> {
    const now = new Date();

return this.auctionRepo.find({
        where: {
            startTime: LessThan(now),
            endTime: MoreThan(now),
        },
        relations: ['nft'],
        });
 }
}
