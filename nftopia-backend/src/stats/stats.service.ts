import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NFT } from '../nfts/entities/nft.entity';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Between } from 'typeorm';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(NFT)
    private readonly nftRepository: Repository<NFT>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  async getPopularThisWeek(): Promise<NFT[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.transactionRepository.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.nft', 'nft')
      .where('transaction.timestamp >= :oneWeekAgo', { oneWeekAgo })
      .andWhere('transaction.status = :status', { status: 'completed' })
      .select('transaction.nft')
      .addSelect('COUNT(transaction.id)', 'salesCount')
      .groupBy('transaction.nft.id')
      .orderBy('"salesCount"', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async getTopSellers(): Promise<User[]> {
    return this.transactionRepository.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.seller', 'seller')
      .where('transaction.status = :status', { status: 'completed' })
      .select('transaction.sellerId', 'sellerId')
      .addSelect('SUM(transaction.amount)', 'totalSales')
      .groupBy('transaction.sellerId')
      .orderBy('"totalSales"', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async getNFTsByCategory(category: string): Promise<NFT[]> {
    return this.nftRepository.createQueryBuilder('nft')
      .where("nft.metadata ->> 'category' = :category", { category })
      .andWhere('nft.isListed = true')
      .orderBy('nft.price', 'DESC')
      .getMany();
  }
}

