import {
  resolveToolSet,
  registerToolSet,
  unregisterToolSet,
  assertToolSetIntegrity,
} from './tool-set.registry';
import {
  buildMarketplaceTools,
  MARKETPLACE_TOOL_NAMES,
} from './marketplace.tools';
import {
  buildModerationTools,
  MODERATION_TOOL_NAMES,
} from './moderation.tools';
import {
  buildCreatorCopilotTools,
  CREATOR_COPILOT_TOOL_NAMES,
} from './creator-copilot.tools';
import type { RunnableToolLike, ToolSetName } from './tool-set.types';

const fakeDeps = {
  nftService: {} as never,
  listingService: {} as never,
  collectionService: {} as never,
  orderService: {} as never,
  auctionService: {} as never,
  userId: 'user-1',
};

const fakeModerationDeps = {
  contentFlagService: {} as never,
  expectedEntity: { entityType: 'listing' as const, entityId: 'listing-1' },
};

const fakeCreatorCopilotDeps = {
  expectedNftId: 'nft-1',
};

/** Minimal stand-in for a resolved tool — only `.name` is read by the guard. */
const fakeTool = (name: string): RunnableToolLike =>
  ({ name }) as unknown as RunnableToolLike;

describe('tool-set.registry', () => {
  describe('resolveToolSet("marketplace-assistant")', () => {
    it('returns exactly the tools declared in MARKETPLACE_TOOL_NAMES', () => {
      const tools = resolveToolSet('marketplace-assistant', fakeDeps);
      const names = tools.map((tool) => tool.name).sort();

      expect(names).toEqual([...MARKETPLACE_TOOL_NAMES].sort());
    });

    it('does not throw', () => {
      expect(() =>
        resolveToolSet('marketplace-assistant', fakeDeps),
      ).not.toThrow();
    });
  });

  describe('MARKETPLACE_TOOL_NAMES', () => {
    it('has no duplicates', () => {
      expect(new Set(MARKETPLACE_TOOL_NAMES).size).toBe(
        MARKETPLACE_TOOL_NAMES.length,
      );
    });

    it('matches exactly what buildMarketplaceTools actually returns (no drift)', () => {
      const actualNames = buildMarketplaceTools(fakeDeps)
        .map((tool) => tool.name)
        .sort();

      expect(actualNames).toEqual([...MARKETPLACE_TOOL_NAMES].sort());
    });
  });

  describe('resolveToolSet("moderation")', () => {
    it('returns exactly the tools declared in MODERATION_TOOL_NAMES', () => {
      const tools = resolveToolSet('moderation', fakeModerationDeps);
      const names = tools.map((tool) => tool.name).sort();

      expect(names).toEqual([...MODERATION_TOOL_NAMES].sort());
    });

    it('does not throw', () => {
      expect(() =>
        resolveToolSet('moderation', fakeModerationDeps),
      ).not.toThrow();
    });
  });

  describe('MODERATION_TOOL_NAMES', () => {
    it('has no duplicates', () => {
      expect(new Set(MODERATION_TOOL_NAMES).size).toBe(
        MODERATION_TOOL_NAMES.length,
      );
    });

    it('matches exactly what buildModerationTools actually returns (no drift)', () => {
      const actualNames = buildModerationTools(fakeModerationDeps)
        .map((tool) => tool.name)
        .sort();

      expect(actualNames).toEqual([...MODERATION_TOOL_NAMES].sort());
    });

    it('does not appear in the marketplace-assistant tool set', () => {
      const marketplaceNames = resolveToolSet(
        'marketplace-assistant',
        fakeDeps,
      ).map((tool) => tool.name);

      expect(marketplaceNames).not.toContain('flag_content');
    });
  });

  describe('resolveToolSet("creator-copilot") (#528)', () => {
    it('returns exactly the tools declared in CREATOR_COPILOT_TOOL_NAMES', () => {
      const tools = resolveToolSet('creator-copilot', fakeCreatorCopilotDeps);
      const names = tools.map((tool) => tool.name).sort();

      expect(names).toEqual([...CREATOR_COPILOT_TOOL_NAMES].sort());
    });

    it('does not throw', () => {
      expect(() =>
        resolveToolSet('creator-copilot', fakeCreatorCopilotDeps),
      ).not.toThrow();
    });
  });

  describe('CREATOR_COPILOT_TOOL_NAMES', () => {
    it('has no duplicates', () => {
      expect(new Set(CREATOR_COPILOT_TOOL_NAMES).size).toBe(
        CREATOR_COPILOT_TOOL_NAMES.length,
      );
    });

    it('matches exactly what buildCreatorCopilotTools actually returns (no drift)', () => {
      const actualNames = buildCreatorCopilotTools(fakeCreatorCopilotDeps)
        .map((tool) => tool.name)
        .sort();

      expect(actualNames).toEqual([...CREATOR_COPILOT_TOOL_NAMES].sort());
    });

    it('does not appear in the marketplace-assistant tool set', () => {
      const marketplaceNames = resolveToolSet(
        'marketplace-assistant',
        fakeDeps,
      ).map((tool) => tool.name);

      expect(marketplaceNames).not.toContain('draft_listing');
    });
  });

  describe('resolveToolSet for an unregistered tool set', () => {
    it.each<ToolSetName>(['trading'])(
      'throws for "%s" since no builder is registered yet',
      (name) => {
        expect(() => resolveToolSet(name, fakeDeps)).toThrow(
          /is not registered/,
        );
      },
    );
  });

  describe('assertToolSetIntegrity', () => {
    it('does not throw when every resolved tool is declared', () => {
      const owned = new Set(['search_nfts', 'get_nft']);
      expect(() =>
        assertToolSetIntegrity(
          'marketplace-assistant',
          [fakeTool('search_nfts')],
          owned,
        ),
      ).not.toThrow();
    });

    it('throws when a resolved tool is not declared as belonging to the set', () => {
      const owned = new Set(['search_nfts']);
      expect(() =>
        assertToolSetIntegrity(
          'marketplace-assistant',
          [fakeTool('search_nfts'), fakeTool('flag_content')],
          owned,
        ),
      ).toThrow(/flag_content/);
    });

    it('lists every undeclared tool in the error, not just the first', () => {
      const owned = new Set<string>();
      expect(() =>
        assertToolSetIntegrity(
          'marketplace-assistant',
          [fakeTool('rogue_a'), fakeTool('rogue_b')],
          owned,
        ),
      ).toThrow(/rogue_a.*rogue_b/);
    });
  });

  describe('scope isolation across tool sets registered in the same process', () => {
    // 'trading' has no real registration (unlike 'creator-copilot', which
    // is registered for real since #528) — safe to hijack as a throwaway
    // sandbox name for these tests without clobbering anything real.
    afterEach(() => {
      unregisterToolSet('trading');
    });

    it('does not leak another registered tool set into marketplace-assistant', () => {
      registerToolSet('trading', () => [fakeTool('propose_trade')], [
        'propose_trade',
      ]);

      const marketplaceTools = resolveToolSet(
        'marketplace-assistant',
        fakeDeps,
      );
      const marketplaceNames = marketplaceTools.map((tool) => tool.name);

      expect(marketplaceNames).not.toContain('propose_trade');
      expect(marketplaceNames.sort()).toEqual(
        [...MARKETPLACE_TOOL_NAMES].sort(),
      );
    });

    it('resolves the other tool set on its own, unaffected by marketplace-assistant', () => {
      registerToolSet('trading', () => [fakeTool('propose_trade')], [
        'propose_trade',
      ]);

      const tradingTools = resolveToolSet('trading', fakeDeps);

      expect(tradingTools.map((tool) => tool.name)).toEqual(['propose_trade']);
    });

    it('catches a tool set builder pulling in a tool it never declared', () => {
      registerToolSet(
        'trading',
        () => [fakeTool('propose_trade'), fakeTool('search_nfts')], // 'search_nfts' undeclared here
        ['propose_trade'],
      );

      expect(() => resolveToolSet('trading', fakeDeps)).toThrow(/search_nfts/);
    });
  });
});
