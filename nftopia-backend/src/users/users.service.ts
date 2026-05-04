import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserWallet } from '../auth/entities/user-wallet.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletRepo: Repository<UserWallet>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) {
      return Promise.resolve([]);
    }

    return this.repo.find({ where: { id: In(uniqueIds) } });
  }

  findByAddress(address: string) {
    return this.repo.findOne({ where: { address } });
  }

  findByStellarAddress(address: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.address = :address OR u.walletAddress = :address', { address })
      .getOne();
  }

  async updateProfile(address: string, data: UpdateProfileDto) {
    const user = await this.findByAddress(address);
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, data);
    const savedUser = await this.repo.save(user);
    setImmediate(() => {
      this.eventEmitter.emit('search.user.upsert', { userId: savedUser.id });
    });
    return savedUser;
  }

  listWallets(userId: string) {
    return this.walletRepo.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async getUserTransactionVolume(userId: string): Promise<string> {
    const result = (await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(t.amount), 0)', 'volume')
      .from('transactions', 't')
      .where('t.buyerId = :userId OR t.sellerId = :userId', { userId })
      .andWhere('t.state = :state', { state: 'completed' })
      .getRawOne()) as { volume?: string } | null;

    return result?.volume || '0';
  }
}
