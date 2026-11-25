import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveToolSet } from '../tools/tool-set.registry';
import type { ToolSetName, ToolLogger } from '../tools/tool-set.types';

type Scenario = {
  id: string;
  prompt: string;
  expectedTools?: string[];
  mustNotCall?: string[];
};

type Result = { passed: boolean; called: string[]; reason?: string };

const toolSets: ToolSetName[] = ['marketplace-assistant', 'creator-copilot', 'moderation', 'trading'];
const root = resolve(__dirname);

function fakeService(): Record<string, unknown> {
  return new Proxy({}, { get: () => async () => [] });
}

function toolsFor(name: ToolSetName, toolLogger: ToolLogger, prompt: string) {
  if (name === 'marketplace-assistant') {
    return resolveToolSet(name, {
      nftService: fakeService(), listingService: fakeService(), collectionService: fakeService(),
      orderService: fakeService(), auctionService: fakeService(), userId: 'eval-user', toolLogger,
    } as any);
  }
  if (name === 'creator-copilot') {
    return resolveToolSet(name, { expectedNftId: prompt.match(/[0-9a-f-]{36}/i)?.[0] ?? '550e8400-e29b-41d4-a716-446655440000', toolLogger } as any);
  }
  if (name === 'moderation') {
    return resolveToolSet(name, {
      contentFlagService: fakeService(), expectedEntity: { entityType: 'listing', entityId: prompt.match(/[0-9a-f-]{36}/i)?.[0] ?? '550e8400-e29b-41d4-a716-446655440000' }, toolLogger,
    } as any);
  }
  return resolveToolSet(name, { userId: 'eval-user', orderService: fakeService(), offerService: fakeService(), toolLogger } as any);
}

async function scenariosFor(name: ToolSetName): Promise<Scenario[]> {
  const path = resolve(root, 'scenarios', `${name}.json`);
  return JSON.parse(await readFile(path, 'utf8')) as Scenario[];
}

async function runScenario(client: Anthropic, name: ToolSetName, scenario: Scenario): Promise<Result> {
  const called: string[] = [];
  const logger: ToolLogger = (toolName) => called.push(toolName);
  const tools = toolsFor(name, logger, scenario.prompt);
  await client.beta.messages.toolRunner({
    model: process.env.AI_EVAL_MODEL || 'claude-opus-5',
    max_tokens: 2000,
    system: `You are evaluating the ${name} tool set. Use only the tool that best matches the request. For moderation, do not flag benign content.`,
    tools,
    messages: [{ role: 'user', content: scenario.prompt }],
  });

  const expected = scenario.expectedTools ?? [];
  const missing = expected.filter((tool) => !called.includes(tool));
  const forbidden = (scenario.mustNotCall ?? []).filter((tool) => called.includes(tool));
  if (missing.length > 0) return { passed: false, called, reason: `missing expected tool(s): ${missing.join(', ')}` };
  if (forbidden.length > 0) return { passed: false, called, reason: `called forbidden tool(s): ${forbidden.join(', ')}` };
  return { passed: true, called };
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required; this opt-in command makes real model calls.');
    process.exitCode = 2;
    return;
  }

  const client = new Anthropic();
  let passed = 0;
  let total = 0;
  for (const name of toolSets) {
    const scenarios = await scenariosFor(name);
    if (scenarios.length < 5) throw new Error(`${name} must have at least five scenarios`);
    let setPassed = 0;
    for (const scenario of scenarios) {
      total += 1;
      const result = await runScenario(client, name, scenario);
      if (result.passed) { passed += 1; setPassed += 1; }
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${name}/${scenario.id}${result.reason ? ` — ${result.reason}` : ''}`);
    }
    console.log(`${name}: ${setPassed}/${scenarios.length}`);
  }
  console.log(`overall: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
  if (passed !== total) process.exitCode = 1;
}

void main();
