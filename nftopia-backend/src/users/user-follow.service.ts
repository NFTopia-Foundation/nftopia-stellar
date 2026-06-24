import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFollow } from './user-follow.entity';

@Injectable()
export class UserFollowService {
  constructor(
    @InjectRepository(UserFollow)
    private readonly followRepo: Repository<UserFollow>,
  ) {}

  async followerCount(userId: string): Promise<number> {
    return this.followRepo.count({ where: { followingId: userId } });
  }

  async followingCount(userId: string): Promise<number> {
    return this.followRepo.count({ where: { followerId: userId } });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId) return false;
    const row = await this.followRepo.findOne({
      where: { followerId, followingId },
    });
    return !!row;
  }

  async follow(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const existing = await this.followRepo.findOne({
      where: { followerId, followingId },
    });
    if (existing) {
      return true;
    }

    await this.followRepo.save(
      this.followRepo.create({ followerId, followingId }),
    );
    return true;
  }

  async unfollow(followerId: string, followingId: string): Promise<boolean> {
    const result = await this.followRepo.delete({ followerId, followingId });
    if (!result.affected) {
      throw new NotFoundException('Follow relationship not found');
    }
    return true;
  }
}
