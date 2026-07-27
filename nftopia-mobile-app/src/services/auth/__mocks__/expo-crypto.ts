export const CryptoDigestAlgorithm = {
  SHA256: "SHA-256",
  SHA384: "SHA-384",
  SHA512: "SHA-512",
  MD2: "MD2",
  MD4: "MD4",
  MD5: "MD5",
};

export const digestStringAsync = jest
  .fn()
  .mockImplementation(
    (_algo: string, input: string) =>
      Promise.resolve(Buffer.from(input).toString("hex").slice(0, 64)),
  );
