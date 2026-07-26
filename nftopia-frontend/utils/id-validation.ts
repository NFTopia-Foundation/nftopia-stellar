const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_REGEX = /^\d+$/;
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;
const SOROBAN_CONTRACT_REGEX = /^C[A-Z2-7]{55}$/;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function isValidNumericId(id: string): boolean {
  return NUMERIC_REGEX.test(id) && !id.startsWith("0");
}

export function isValidStellarPublicKey(id: string): boolean {
  return STELLAR_PUBLIC_KEY_REGEX.test(id);
}

export function isValidSorobanContractId(id: string): boolean {
  return SOROBAN_CONTRACT_REGEX.test(id);
}

export function isValidNFTId(id: string): boolean {
  return isValidUUID(id) || isValidNumericId(id) || isValidSorobanContractId(id);
}

export function isValidCollectionId(id: string): boolean {
  return isValidUUID(id) || isValidNumericId(id) || isValidSorobanContractId(id);
}

export function isValidAuctionId(id: string): boolean {
  return isValidUUID(id) || isValidNumericId(id);
}
