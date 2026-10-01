import {
  buildCreatorCopilotTools,
  CREATOR_COPILOT_TOOL_NAMES,
} from './creator-copilot.tools';
import type { RunnableToolLike } from './tool-set.types';

describe('creator-copilot.tools (#528)', () => {
  const NFT_ID = '123e4567-e89b-12d3-a456-426614174000';
  const OTHER_NFT_ID = '00000000-0000-4000-8000-000000000000';

  const getTool = (expectedNftId = NFT_ID): RunnableToolLike => {
    const tools = buildCreatorCopilotTools({ expectedNftId });
    const tool = tools.find((t) => t.name === 'draft_listing');
    if (!tool) throw new Error('Tool "draft_listing" not found');
    return tool;
  };

  const validInput = {
    nftId: NFT_ID,
    title: 'Cosmic Ape #7',
    description:
      'A rare cosmic ape with laser eyes, one of 100 in the collection.',
    suggestedPrice: 250,
    currency: 'XLM' as const,
    reasoning:
      'Priced above the collection floor due to the rare laser-eyes trait.',
  };

  it('exposes draft_listing in CREATOR_COPILOT_TOOL_NAMES', () => {
    expect(CREATOR_COPILOT_TOOL_NAMES).toContain('draft_listing');
  });

  it('matches exactly what buildCreatorCopilotTools returns (no drift)', () => {
    const names = buildCreatorCopilotTools({ expectedNftId: 'nft-1' }).map(
      (t) => t.name,
    );
    expect(names).toEqual([...CREATOR_COPILOT_TOOL_NAMES]);
  });

  it('returns the draft as JSON, echoing the submitted fields', async () => {
    const result = await getTool().run(validInput);

    expect(JSON.parse(result as string)).toEqual({
      nftId: NFT_ID,
      title: validInput.title,
      description: validInput.description,
      suggestedPrice: 250,
      currency: 'XLM',
      reasoning: validInput.reasoning,
    });
  });

  it('rejects a draft for a different NFT than the one requested (never trusts nftId from the model alone)', async () => {
    await expect(
      getTool(NFT_ID).run({ ...validInput, nftId: OTHER_NFT_ID }),
    ).rejects.toThrow(/different NFT/);
  });

  it('accepts USDC as an alternate currency', async () => {
    const result = await getTool().run({ ...validInput, currency: 'USDC' });
    const parsed = JSON.parse(result as string) as { currency: string };
    expect(parsed.currency).toBe('USDC');
  });

  it('defaults currency to XLM when omitted', () => {
    const tool = getTool();
    const parsed = tool.parse({
      nftId: NFT_ID,
      title: 'A title',
      description: 'A description',
      suggestedPrice: 10,
      reasoning: 'Because.',
    }) as Record<string, unknown>;

    expect(parsed.currency).toBe('XLM');
  });

  it('rejects a non-positive suggested price', () => {
    const tool = getTool();
    expect(() => {
      tool.parse({ ...validInput, suggestedPrice: 0 });
    }).toThrow();
    expect(() => {
      tool.parse({ ...validInput, suggestedPrice: -5 });
    }).toThrow();
  });

  it('rejects a missing title/description/reasoning', () => {
    const tool = getTool();
    expect(() => {
      tool.parse({ ...validInput, title: '' });
    }).toThrow();
    expect(() => {
      tool.parse({ ...validInput, description: '' });
    }).toThrow();
    expect(() => {
      tool.parse({ ...validInput, reasoning: '' });
    }).toThrow();
  });

  it('rejects an nftId that is not a UUID-shaped value at parse time when expected to be one', () => {
    // draft_listing's schema requires a UUID; a non-UUID nftId should fail
    // parse() before run() is ever reached, regardless of expectedNftId.
    const tool = getTool('not-a-uuid');
    expect(() => {
      tool.parse({ ...validInput, nftId: 'not-a-uuid' });
    }).toThrow();
  });

  it('calls the tool logger with a truncated summary on success', async () => {
    const toolLogger = jest.fn();
    const tools = buildCreatorCopilotTools({
      expectedNftId: NFT_ID,
      toolLogger,
    });
    const tool = tools.find((t) => t.name === 'draft_listing')!;

    await tool.run(validInput);

    expect(toolLogger).toHaveBeenCalledWith(
      'draft_listing',
      expect.objectContaining({ nftId: NFT_ID }),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('calls the tool logger with the error message on rejection', async () => {
    const toolLogger = jest.fn();
    const tools = buildCreatorCopilotTools({
      expectedNftId: NFT_ID,
      toolLogger,
    });
    const tool = tools.find((t) => t.name === 'draft_listing')!;

    await expect(
      tool.run({ ...validInput, nftId: OTHER_NFT_ID }),
    ).rejects.toThrow();

    expect(toolLogger).toHaveBeenCalledWith(
      'draft_listing',
      expect.objectContaining({ nftId: OTHER_NFT_ID }),
      expect.stringContaining('Error:'),
      expect.any(Number),
    );
  });
});
