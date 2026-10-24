import {
  buildModerationTools,
  MODERATION_TOOL_NAMES,
  type ModerationToolsDeps,
} from './moderation.tools';
import type { ContentFlag } from '../entities/content-flag.entity';

describe('moderation.tools', () => {
  const LISTING_ID = '123e4567-e89b-12d3-a456-426614174000';
  const OTHER_ID = '00000000-0000-4000-8000-000000000000';

  const contentFlagService = {
    createFlagIfAboveThreshold: jest.fn(),
  };

  const defaultExpectedEntity: ModerationToolsDeps ['expectedEntity'] = {
    entityType: 'listing',
    entityId: LISTING_ID,
  };

  const getTool = (
    name: string,
    expectedEntity: ModerationToolsDeps['expectedEntity'] = defaultExpectedEntity,
  ) => {
    const tools = buildModerationTools({
      contentFlagService: contentFlagService as never,
      expectedEntity,
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
      expectedEntity: defaultExpectedEntity,
    }).map((tool) => tool.name);
    expect(names.sort()).toEqual([...MODERATION_TOOL_NAMES].sort());
  });

  describe('flag_content', () => {
    it('persists a flag via ContentFlagService and returns its id and status', async () => {
      const savedFlag: Partial<ContentFlag> = {
        id: 'flag-1',
        status: 'pending',
        entityType: 'listing',
        entityId: LISTING_ID,
      };
      contentFlagService.createFlagIfAboveThreshold.mockResolvedValue({
        flagged: true,
        flag: savedFlag,
        threshold: 0.7,
      });

      const input = {
        entityType: 'listing' as const,
        entityId: LISTING_ID,
        reason: 'Depicts prohibited content',
        severity: 'high' as const,
        confidence: 0.92,
      };

      const result = await getTool('flag_content').run(input);

      expect(contentFlagService.createFlagIfAboveThreshold).toHaveBeenCalledWith(
        input,
      );
      expect(JSON.parse(result as string)).toEqual({
        flagged: true,
        id: 'flag-1',
        status: 'pending',
        entityType: 'listing',
        entityId: LISTING_ID,
        threshold: 0.7,
      });
    });

    it('reports auto-cleared when confidence is below the threshold', async () => {
      contentFlagService.createFlagIfAboveThreshold.mockResolvedValue({
        flagged: false,
        threshold: 0.7,
      });

      const input = {
        entityType: 'listing' as const,
        entityId: LISTING_ID,
        reason: 'Low confidence signal',
        severity: 'low' as const,
        confidence: 0.3,
      };

      const result = await getTool('flag_content').run(input);

      expect(JSON.parse(result as string)).toEqual({
        flagged: false,
        autoCleared: true,
        confidence: 0.3,
        threshold: 0.7,
        entityType: 'listing',
        entityId: LISTING_ID,
      });
    });

    it('rejects a flag for a different entity than the one under review (never trusts entityId from the model alone)', async () => {
      await expect(
        getTool('flag_content', {
          entityType: 'listing',
          entityId: LISTING_ID,
        }).run({
          entityType: 'listing',
          entityId: OTHER_ID,
          reason: 'x',
          severity: 'low',
          confidence: 0.5,
        }),
      ).rejects.toThrow(/does not match/);
      expect(contentFlagService.createFlagIfAboveThreshold).not.toHaveBeenCalled();
    });

    it('rejects a flag for a different entityType than the one under review', async () => {
      await expect(
        getTool('flag_content', {
          entityType: 'listing',
          entityId: LISTING_ID,
        }).run({
          entityType: 'nft',
          entityId: LISTING_ID,
          reason: 'x',
          severity: 'low',
          confidence: 0.5,
        }),
      ).rejects.toThrow(/does not match/);
      expect(contentFlagService.createFlagIfAboveThreshold).not.toHaveBeenCalled();
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
      contentFlagService.createFlagIfAboveThreshold.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        getTool('flag_content', {
          entityType: 'collection',
          entityId: OTHER_ID,
        }).run({
          entityType: 'collection',
          entityId: OTHER_ID,
          reason: 'x',
          severity: 'critical',
          confidence: 0.99,
        }),
      ).rejects.toThrow('db down');
    });

    it('produces exactly one log entry when toolLogger is provided', async () => {
      const savedFlag = {
        id: 'flag-2',
        status: 'pending',
        entityType: 'nft',
        entityId: OTHER_ID,
      };
      contentFlagService.createFlagIfAboveThreshold.mockResolvedValue({
        flagged: true,
        flag: savedFlag,
        threshold: 0.7,
      });
      const toolLogger = jest.fn();

      const tools = buildModerationTools({
        contentFlagService: contentFlagService as never,
        expectedEntity: { entityType: 'nft', entityId: OTHER_ID },
        toolLogger,
      });
      const tool = tools.find((t) => t.name === 'flag_content')!;

      const input = {
        entityType: 'nft' as const,
        entityId: OTHER_ID,
        reason: 'spam',
        severity: 'low' as const,
        confidence: 0.8,
      };

      await tool.run(input);

      expect(toolLogger).toHaveBeenCalledTimes(1);
      expect(toolLogger).toHaveBeenCalledWith(
        'flag_content',
        input,
        expect.any(string),
        expect.any(Number),
      );
    });

    it('produces a log entry even if the tool invocation fails', async () => {
      contentFlagService.createFlagIfAboveThreshold.mockRejectedValue(
        new Error('db down'),
      );
      const toolLogger = jest.fn();

      const tools = buildModerationTools({
        contentFlagService: contentFlagService as never,
        expectedEntity: { entityType: 'nft', entityId: OTHER_ID },
        toolLogger,
      });
      const tool = tools.find((t) => t.name === 'flag_content')!;

      const input = {
        entityType: 'nft' as const,
        entityId: OTHER_ID,
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
        expect.any(Number),
      );
    });
  });
});
