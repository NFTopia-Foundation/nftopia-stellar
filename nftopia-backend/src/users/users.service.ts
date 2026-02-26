import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchService } from '../search/search.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
    private readonly searchService: SearchService,
  ) {}

  findByAddress(address: string) {
    return this.repo.findOne({ where: { address } });
  }

  async updateProfile(address: string, data: UpdateProfileDto) {
    const user = await this.findByAddress(address);
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, data);
    const saved = await this.repo.save(user);
    this.searchService.indexUser(saved).catch((err) => this.logger.warn(`Search indexUser failed: ${(err as Error).message}`));
    return saved;
  }
}
