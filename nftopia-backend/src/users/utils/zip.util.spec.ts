import { inflateRawSync } from 'zlib';
import { createZip, crc32 } from './zip.util';

describe('zip.util', () => {
  it('computes the standard CRC-32 for a known value', () => {
    // CRC-32 of "123456789" is 0xCBF43926
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });

  it('creates an archive with valid signatures and readable entries', () => {
    const zip = createZip([
      { name: 'profile.json', content: '{"id":"1"}' },
      { name: 'notes.txt', content: 'hello world' },
    ]);

    expect(zip.subarray(0, 4).toString('binary')).toBe('PK\x03\x04');
    expect(zip.includes(Buffer.from('PK\x01\x02'))).toBe(true);
    expect(zip.includes(Buffer.from('PK\x05\x06'))).toBe(true);

    const nameLength = zip.readUInt16LE(26);
    const compressedSize = zip.readUInt32LE(18);
    const name = zip.subarray(30, 30 + nameLength).toString('utf8');
    const dataStart = 30 + nameLength;
    const data = inflateRawSync(
      zip.subarray(dataStart, dataStart + compressedSize),
    ).toString('utf8');

    expect(name).toBe('profile.json');
    expect(data).toBe('{"id":"1"}');
  });
});
