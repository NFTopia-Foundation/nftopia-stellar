import { buildShareLink, buildShareContent, SHARE_LINK_HOST } from './shareLink';

describe('buildShareLink', () => {
  it('builds a canonical NFT link', () => {
    expect(buildShareLink('nft', 'nft-123')).toBe(
      `https://${SHARE_LINK_HOST}/nft/nft-123`,
    );
  });

  it('builds a canonical collection link', () => {
    expect(buildShareLink('collection', 'col-abc')).toBe(
      `https://${SHARE_LINK_HOST}/collection/col-abc`,
    );
  });

  it('builds a canonical profile link', () => {
    expect(buildShareLink('profile', 'user-42')).toBe(
      `https://${SHARE_LINK_HOST}/profile/user-42`,
    );
  });

  it('throws when id is empty', () => {
    expect(() => buildShareLink('nft', '')).toThrow(/id is required/);
  });

  it('uses https, never the custom nftopia:// scheme', () => {
    const url = buildShareLink('nft', 'nft-1');
    expect(url.startsWith('https://')).toBe(true);
  });
});

describe('buildShareContent', () => {
  it('falls back to a generic title when no name is given', () => {
    const content = buildShareContent('collection', 'col-1');
    expect(content.title).toBe('Check out this collection on NFTopia');
  });

  it('personalises the title when a name is given', () => {
    const content = buildShareContent('nft', 'nft-1', 'Cosmic Ape #7');
    expect(content.title).toBe('Cosmic Ape #7 on NFTopia');
  });

  it('folds the url into the message so it survives on platforms that drop the url field', () => {
    const content = buildShareContent('nft', 'nft-1', 'Cosmic Ape #7');
    expect(content.message).toContain(content.url);
    expect(content.message).toContain(content.title);
  });

  it('returns the same url as buildShareLink for matching inputs', () => {
    const content = buildShareContent('profile', 'user-9');
    expect(content.url).toBe(buildShareLink('profile', 'user-9'));
  });
});
