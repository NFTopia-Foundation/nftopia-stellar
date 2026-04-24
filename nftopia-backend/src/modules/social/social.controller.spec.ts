import { Test, TestingModule } from '@nestjs/testing';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { ActivityType } from './entities/activity.entity';

const mockSocialService = {
  follow: jest.fn(),
  unfollow: jest.fn(),
  getFeed: jest.fn(),
};

const mockRequest = {
  user: { userId: 'user-1' },
} as any;

describe('SocialController', () => {
  let controller: SocialController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialController],
      providers: [{ provide: SocialService, useValue: mockSocialService }],
    }).compile();

    controller = module.get<SocialController>(SocialController);
    jest.clearAllMocks();
  });

  describe('follow', () => {
    it('calls service.follow with correct params', async () => {
      mockSocialService.follow.mockResolvedValue({ id: 'f1' });

      const result = await controller.follow('user-2', mockRequest);

      expect(mockSocialService.follow).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result.id).toBe('f1');
    });
  });

  describe('unfollow', () => {
    it('calls service.unfollow with correct params', async () => {
      mockSocialService.unfollow.mockResolvedValue({ success: true });

      const result = await controller.unfollow('user-2', mockRequest);

      expect(mockSocialService.unfollow).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result.success).toBe(true);
    });
  });

  describe('feed', () => {
    it('calls service.getFeed with default limit', async () => {
      const activities = [
        { id: 'a1', actorId: 'user-2', type: ActivityType.MINT },
      ];
      mockSocialService.getFeed.mockResolvedValue(activities);

      const result = await controller.feed(mockRequest);

      expect(mockSocialService.getFeed).toHaveBeenCalledWith('user-1', 50);
      expect(result).toHaveLength(1);
    });

    it('calls service.getFeed with custom limit', async () => {
      mockSocialService.getFeed.mockResolvedValue([]);

      await controller.feed(mockRequest, '10');

      expect(mockSocialService.getFeed).toHaveBeenCalledWith('user-1', 10);
    });
  });
});
