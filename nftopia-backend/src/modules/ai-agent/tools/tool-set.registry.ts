import type {
  RunnableToolLike,
  ToolSetBuilder,
  ToolSetName,
  ToolSetRegistration,
} from './tool-set.types';
import {
  buildMarketplaceTools,
  MARKETPLACE_TOOL_NAMES,
  type MarketplaceToolsDeps,
} from './marketplace.tools';
import {
  buildModerationTools,
  MODERATION_TOOL_NAMES,
  type ModerationToolsDeps,
} from './moderation.tools';

const registry = new Map<ToolSetName, ToolSetRegistration<any>>();

/**
 * Registers a tool set builder along with the exact tool names it's allowed
 * to produce. Call this once, at module load, from each tool-set's own
 * file — keeps the ownership declaration next to the builder that has to
 * honor it, so a new tools file self-registers rather than requiring an
 * edit to this central file for every addition.
 */
export function registerToolSet<TDeps>(
  name: ToolSetName,
  build: ToolSetBuilder<TDeps>,
  ownedToolNames: readonly string[],
): void {
  registry.set(name, {
    build: build,
    ownedToolNames: new Set(ownedToolNames),
  });
}

/** Removes a registration. Exported only for test isolation. */
export function unregisterToolSet(name: ToolSetName): void {
  registry.delete(name);
}

registerToolSet<MarketplaceToolsDeps>(
  'marketplace-assistant',
  buildMarketplaceTools,
  MARKETPLACE_TOOL_NAMES,
);

registerToolSet<ModerationToolsDeps>(
  'moderation',
  buildModerationTools,
  MODERATION_TOOL_NAMES,
);

/**
 * Resolves the named tool set against the given deps and verifies every
 * returned tool was declared as belonging to it. Throws if the tool set
 * isn't registered, or if the builder returns a tool outside its declared
 * ownership — the runtime guard against scope creep described in #492.
 */
export function resolveToolSet<TDeps>(
  name: ToolSetName,
  deps: TDeps,
): RunnableToolLike[] {
  const registration = registry.get(name);
  if (!registration) {
    throw new Error(
      `Tool set "${name}" is not registered. Available: ${
        [...registry.keys()].join(', ') || 'none'
      }.`,
    );
  }

  const tools = registration.build(deps);
  assertToolSetIntegrity(name, tools, registration.ownedToolNames);
  return tools;
}

/**
 * Fails if any resolved tool isn't declared as belonging to the named tool
 * set. Takes the resolved tools and the owned-names set directly (not the
 * registry) so it can be exercised in isolation with hand-built tool
 * lists — no real service dependencies required.
 */
export function assertToolSetIntegrity(
  name: ToolSetName,
  tools: RunnableToolLike[],
  ownedToolNames: ReadonlySet<string>,
): void {
  const undeclared = tools
    .map((tool) => tool.name)
    .filter((toolName) => !ownedToolNames.has(toolName));

  if (undeclared.length > 0) {
    throw new Error(
      `Tool set "${name}" resolved tool(s) not declared as belonging to it: ` +
        `${undeclared.join(', ')}. Add them to its ownedToolNames in ` +
        'registerToolSet(), or remove them from the builder.',
    );
  }
}
