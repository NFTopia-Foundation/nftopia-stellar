import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  findByAddress(address: string) {
    return this.repo.findOne({ where: { address } });
  }

  async updateProfile(address: string, data: UpdateProfileDto) {
    const user = await this.findByAddress(address);
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, data);
    return this.repo.save(user);
  }
}
