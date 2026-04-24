import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SocialService } from './social.service';
import { Follow } from './entities/follow.entity';
import { Activity, ActivityType } from './entities/activity.entity';

const mockFollowRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockActivityRepo = {
  find: jest.fn(),
};

describe('SocialService', () => {
  let service: SocialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: getRepositoryToken(Follow), useValue: mockFollowRepo },
        { provide: getRepositoryToken(Activity), useValue: mockActivityRepo },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
    jest.clearAllMocks();
  });

  describe('follow', () => {
    it('creates a follow relationship', async () => {
      mockFollowRepo.findOne.mockResolvedValue(null);
      mockFollowRepo.create.mockReturnValue({ followerId: 'u1', followingId: 'u2' });
      mockFollowRepo.save.mockResolvedValue({ id: 'f1', followerId: 'u1', followingId: 'u2' });

      const result = await service.follow('u1', 'u2');

      expect(mockFollowRepo.create).toHaveBeenCalledWith({ followerId: 'u1', followingId: 'u2' });
      expect(result.id).toBe('f1');
    });

    it('throws BadRequestException when following yourself', async () => {
      await expect(service.follow('u1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already following', async () => {
      mockFollowRepo.findOne.mockResolvedValue({ id: 'f1' });

      await expect(service.follow('u1', 'u2')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unfollow', () => {
    it('removes a follow relationship', async () => {
      const follow = { id: 'f1', followerId: 'u1', followingId: 'u2' };
      mockFollowRepo.findOne.mockResolvedValue(follow);
      mockFollowRepo.remove.mockResolvedValue(follow);

      const result = await service.unfollow('u1', 'u2');

      expect(mockFollowRepo.remove).toHaveBeenCalledWith(follow);
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when follow does not exist', async () => {
      mockFollowRepo.findOne.mockResolvedValue(null);

      await expect(service.unfollow('u1', 'u2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFeed', () => {
    it('returns activities from followed users sorted by date', async () => {
      mockFollowRepo.find.mockResolvedValue([
        { followingId: 'u2' },
        { followingId: 'u3' },
      ]);

      const activities = [
        { id: 'a1', actorId: 'u2', type: ActivityType.MINT, createdAt: new Date() },
        { id: 'a2', actorId: 'u3', type: ActivityType.PURCHASE, createdAt: new Date() },
      ];
      mockActivityRepo.find.mockResolvedValue(activities);

      const result = await service.getFeed('u1');

      expect(mockActivityRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { actorId: expect.anything() },
          order: { createdAt: 'DESC' },
          take: 50,
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('returns empty array when user follows nobody', async () => {
      mockFollowRepo.find.mockResolvedValue([]);

      const result = await service.getFeed('u1');

      expect(mockActivityRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('respects custom limit', async () => {
      mockFollowRepo.find.mockResolvedValue([{ followingId: 'u2' }]);
      mockActivityRepo.find.mockResolvedValue([]);

      await service.getFeed('u1', 10);

      expect(mockActivityRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
