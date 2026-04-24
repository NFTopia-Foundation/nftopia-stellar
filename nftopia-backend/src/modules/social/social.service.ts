import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { Activity } from './entities/activity.entity';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
  ) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const existing = await this.followRepo.findOne({
      where: { followerId, followingId },
    });

    if (existing) {
      throw new BadRequestException('Already following this user');
    }

    const follow = this.followRepo.create({ followerId, followingId });
    return this.followRepo.save(follow);
  }

  async unfollow(followerId: string, followingId: string) {
    const follow = await this.followRepo.findOne({
      where: { followerId, followingId },
    });

    if (!follow) {
      throw new NotFoundException('Follow relationship not found');
    }

    await this.followRepo.remove(follow);
    return { success: true };
  }

  async getFeed(userId: string, limit = 50) {
    const follows = await this.followRepo.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    const followingIds = follows.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return [];
    }

    return this.activityRepo.find({
      where: { actorId: In(followingIds) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
