import {
  buildModerationTools,
  MODERATION_TOOL_NAMES,
} from './moderation.tools';
import type { ContentFlag } from '../entities/content-flag.entity';

describe('moderation.tools', () => {
  const contentFlagService = {
    createFlag: jest.fn(),
  };

  const getTool = (name: string) => {
    const tools = buildModerationTools({
      contentFlagService: contentFlagService as never,
    });
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool "${name}" not found`);
    return tool;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes exactly the tools declared in MODERATION_TOOL_NAMES', () => {
    const names = buildModerationTools({
      contentFlagService: contentFlagService as never,
    }).map((tool) => tool.name);
    expect(names.sort()).toEqual([...MODERATION_TOOL_NAMES].sort());
  });

  describe('flag_content', () => {
    it('persists a flag via ContentFlagService and returns its id and status', async () => {
      const savedFlag: Partial<ContentFlag> = {
        id: 'flag-1',
        status: 'pending',
        entityType: 'listing',
        entityId: 'listing-1',
      };
      contentFlagService.createFlag.mockResolvedValue(savedFlag);

      const input = {
        entityType: 'listing' as const,
        entityId: 'listing-1',
        reason: 'Depicts prohibited content',
        severity: 'high' as const,
        confidence: 0.92,
      };

      const result = await getTool('flag_content').run(input);

      expect(contentFlagService.createFlag).toHaveBeenCalledWith(input);
      expect(JSON.parse(result as string)).toEqual({
        id: 'flag-1',
        status: 'pending',
        entityType: 'listing',
        entityId: 'listing-1',
      });
    });

    it('validates entityId as a uuid', () => {
      const tool = getTool('flag_content');
      expect(() =>
        tool.parse({
          entityType: 'nft',
          entityId: 'not-a-uuid',
          reason: 'x',
          severity: 'low',
          confidence: 0.5,
        }),
      ).toThrow();
    });

    it('validates confidence is within [0, 1]', () => {
      const tool = getTool('flag_content');
      expect(() =>
        tool.parse({
          entityType: 'nft',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'x',
          severity: 'low',
          confidence: 1.5,
        }),
      ).toThrow();
    });

    it('validates entityType is one of listing/nft/collection', () => {
      const tool = getTool('flag_content');
      expect(() =>
        tool.parse({
          entityType: 'user',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'x',
          severity: 'low',
          confidence: 0.5,
        }),
      ).toThrow();
    });

    it('propagates a failure from ContentFlagService rather than swallowing it', async () => {
      contentFlagService.createFlag.mockRejectedValue(new Error('db down'));

      await expect(
        getTool('flag_content').run({
          entityType: 'collection',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'x',
          severity: 'critical',
          confidence: 0.99,
        }),
      ).rejects.toThrow('db down');
    });

    it('produces exactly one log entry when toolLogger is provided', async () => {
      const savedFlag = { id: 'flag-2', status: 'pending', entityType: 'nft', entityId: 'nft-1' };
      contentFlagService.createFlag.mockResolvedValue(savedFlag);
      const toolLogger = jest.fn();
      
      const tools = buildModerationTools({
        contentFlagService: contentFlagService as never,
        toolLogger,
      });
      const tool = tools.find((t) => t.name === 'flag_content')!;
      
      const input = {
        entityType: 'nft' as const,
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        reason: 'spam',
        severity: 'low' as const,
        confidence: 0.8,
      };
      
      await tool.run(input);
      
      expect(toolLogger).toHaveBeenCalledTimes(1);
      expect(toolLogger).toHaveBeenCalledWith(
        'flag_content',
        input,
        expect.any(String),
        expect.any(Number)
      );
    });

    it('produces a log entry even if the tool invocation fails', async () => {
      contentFlagService.createFlag.mockRejectedValue(new Error('db down'));
      const toolLogger = jest.fn();
      
      const tools = buildModerationTools({
        contentFlagService: contentFlagService as never,
        toolLogger,
      });
      const tool = tools.find((t) => t.name === 'flag_content')!;
      
      const input = {
        entityType: 'nft' as const,
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        reason: 'spam',
        severity: 'low' as const,
        confidence: 0.8,
      };
      
      await expect(tool.run(input)).rejects.toThrow('db down');
      
      expect(toolLogger).toHaveBeenCalledTimes(1);
      expect(toolLogger).toHaveBeenCalledWith(
        'flag_content',
        input,
        'Error: db down',
        expect.any(Number)
      );
    });
  });
});
