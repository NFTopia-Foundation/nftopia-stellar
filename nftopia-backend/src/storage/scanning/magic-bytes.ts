/**
 * Minimal binary signature ("magic bytes") table covering exactly the set of
 * MIME types this storage layer allows (see ALLOWED_MIME_TYPES). Kept
 * hand-rolled rather than pulled from a library because the current major
 * signature-sniffing packages (e.g. file-type) ship ESM-only, which conflicts
 * with this project's CommonJS Jest/ts-node toolchain.
 */
interface BinarySignature {
  mime: string;
  matches: (buffer: Buffer) => boolean;
}

const SIGNATURES: BinarySignature[] = [
  {
    mime: 'image/png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/jpeg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mime: 'image/gif',
    matches: (buffer) => {
      const header = buffer.subarray(0, 6).toString('ascii');
      return header === 'GIF87a' || header === 'GIF89a';
    },
  },
  {
    mime: 'image/webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'video/mp4',
    matches: (buffer) =>
      buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp',
  },
  {
    mime: 'video/webm',
    matches: (buffer) =>
      buffer.length >= 4 &&
      buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
  {
    mime: 'audio/mpeg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      (buffer.subarray(0, 3).toString('ascii') === 'ID3' ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)),
  },
];

/** Returns the MIME type matching the buffer's binary signature, or null. */
export const sniffMimeType = (buffer: Buffer): string | null => {
  const match = SIGNATURES.find((signature) => signature.matches(buffer));
  return match?.mime ?? null;
};
