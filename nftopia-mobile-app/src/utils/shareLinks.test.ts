import {
  buildShareLink,
  buildSharePath,
  buildShareContent,
  isShareEntityType,
  DEFAULT_SHARE_ORIGIN,
  SHARE_ENTITY_PATHS,
  ShareEntityType,
} from './shareLinks';

describe('buildSharePath', () => {
  it('builds canonical app paths for every supported entity', () => {
    expect(buildSharePath('nft', 'nft-1')).toBe('/nft/nft-1');
    expect(buildSharePath('collection', 'col-1')).toBe('/collection/col-1');
    expect(buildSharePath('profile', 'user-1')).toBe('/profile/user-1');
    expect(buildSharePath('creator', 'creator-1')).toBe('/creator/creator-1');
    expect(buildSharePath('auction', 'auction-1')).toBe('/auction/auction-1');
  });

  it('url-encodes ids that contain reserved characters', () => {
    expect(buildSharePath('nft', 'a/b c')).toBe('/nft/a%2Fb%20c');
  });

  it('trims surrounding whitespace from ids', () => {
    expect(buildSharePath('collection', '  col-1  ')).toBe('/collection/col-1');
  });

  it('throws for an empty id', () => {
    expect(() => buildSharePath('nft', '')).toThrow(/non-empty id/);
    expect(() => buildSharePath('nft', '   ')).toThrow(/non-empty id/);
  });

  it('throws for an unknown entity type', () => {
    expect(() => buildSharePath('drop' as ShareEntityType, 'x')).toThrow(/Unknown share entity type/);
  });

  it('exposes a template for each shareable type', () => {
    (Object.keys(SHARE_ENTITY_PATHS) as ShareEntityType[]).forEach((type) => {
      expect(SHARE_ENTITY_PATHS[type]).toMatch(/^\//);
      expect(buildSharePath(type, 'id')).toContain('id');
    });
  });
});

describe('buildShareLink', () => {
  it('defaults to the universal link host', () => {
    expect(buildShareLink('nft', 'nft-1')).toBe(`${DEFAULT_SHARE_ORIGIN}/nft/nft-1`);
  });

  it('builds links for collections and profiles', () => {
    expect(buildShareLink('collection', 'col-1')).toBe(`${DEFAULT_SHARE_ORIGIN}/collection/col-1`);
    expect(buildShareLink('creator', 'creator-1')).toBe(`${DEFAULT_SHARE_ORIGIN}/creator/creator-1`);
  });

  it('supports a custom origin and strips a trailing slash', () => {
    expect(buildShareLink('nft', 'nft-1', { baseUrl: 'https://staging.nftopia.io/' })).toBe(
      'https://staging.nftopia.io/nft/nft-1'
    );
  });

  it('builds custom-scheme (deep link) urls', () => {
    expect(buildShareLink('nft', 'nft-1', { format: 'scheme' })).toBe('nftopia://nft/nft-1');
    expect(
      buildShareLink('profile', 'user-1', { format: 'scheme', scheme: 'nftopia-dev' })
    ).toBe('nftopia-dev://profile/user-1');
  });

  it('appends query parameters and skips nullish ones', () => {
    const url = buildShareLink('nft', 'nft-1', {
      query: { ref: 'share', campaign: 'launch', empty: null, missing: undefined },
    });

    expect(url).toBe(`${DEFAULT_SHARE_ORIGIN}/nft/nft-1?ref=share&campaign=launch`);
  });

  it('encodes query keys and values', () => {
    const url = buildShareLink('nft', 'nft-1', { query: { 'a b': 'c d' } });
    expect(url).toBe(`${DEFAULT_SHARE_ORIGIN}/nft/nft-1?a%20b=c%20d`);
  });

  it('produces stable links for the same input', () => {
    expect(buildShareLink('nft', 'nft-1')).toBe(buildShareLink('nft', 'nft-1'));
  });
});

describe('buildShareContent', () => {
  it('returns both the share url and the app path', () => {
    expect(buildShareContent('nft', 'nft-1')).toEqual({
      url: `${DEFAULT_SHARE_ORIGIN}/nft/nft-1`,
      path: '/nft/nft-1',
    });
  });
});

describe('isShareEntityType', () => {
  it('recognises supported types and rejects others', () => {
    expect(isShareEntityType('nft')).toBe(true);
    expect(isShareEntityType('creator')).toBe(true);
    expect(isShareEntityType('blog')).toBe(false);
  });
});
