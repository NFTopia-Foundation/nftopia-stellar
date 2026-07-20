import sharp from 'sharp';
import { FileInspectorService } from './file-inspector.service';

describe('FileInspectorService', () => {
  let service: FileInspectorService;

  beforeEach(() => {
    service = new FileInspectorService();
  });

  it('detects a real PNG by magic bytes', async () => {
    const png = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    expect(service.detectMimeType(png, 'image/png')).toBe('image/png');
  });

  it('returns null when content does not match the claimed image type', () => {
    const buffer = Buffer.from('not-an-image');

    expect(service.detectMimeType(buffer, 'image/png')).toBeNull();
  });

  it('detects SVG content by markup', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect(service.detectMimeType(svg, 'image/svg+xml')).toBe('image/svg+xml');
  });

  it('rejects a spoofed SVG mimetype with non-svg content', () => {
    const buffer = Buffer.from('plain text file');

    expect(service.detectMimeType(buffer, 'image/svg+xml')).toBeNull();
  });

  it('validates application/json content', () => {
    const buffer = Buffer.from(JSON.stringify({ ok: true }));

    expect(service.detectMimeType(buffer, 'application/json')).toBe(
      'application/json',
    );
  });

  it('strips EXIF metadata from a JPEG', async () => {
    const withExif = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .jpeg()
      .withExif({
        IFD0: { Copyright: 'nftopia-test' },
      })
      .toBuffer();

    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const sanitized = await service.sanitize(withExif, 'image/jpeg');
    expect((await sharp(sanitized).metadata()).exif).toBeUndefined();
  });

  it('strips script tags and inline event handlers from SVG', async () => {
    const malicious = Buffer.from(
      '<svg onload="alert(1)"><script>alert(2)</script><rect /></svg>',
    );

    const sanitized = (
      await service.sanitize(malicious, 'image/svg+xml')
    ).toString('utf8');

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onload');
  });
});
