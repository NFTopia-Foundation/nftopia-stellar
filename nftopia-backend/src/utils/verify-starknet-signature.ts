import { keccak_256 } from '@noble/hashes/sha3';
import { verify, Signature } from '@scure/starknet';
import { typedData } from 'starknet';
import { bytesToHex } from '@noble/curves/abstract/utils';



// const { getMessageHash } = typedData;



/**
 * Converts r and s values into a 64-byte compact hex string for @scure/starknet.
 */
function toCompactSignatureHex(r: string, s: string): string {
  const rHex = BigInt(r).toString(16).padStart(64, '0');
  const sHex = BigInt(s).toString(16).padStart(64, '0');
  return '0x' + rHex + sHex;
}

/**
 * ✅ Verifies a raw message signature (Braavos-style)
 */
export function verifyRawMessageSignature(
  walletAddress: string,
  signature: [string, string],
  nonce: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(nonce);
    const msgHashHex = '0x' + bytesToHex(keccak_256(messageBytes));
    const signatureHex = toCompactSignatureHex(signature[0], signature[1]);
    const pubKeyHex = '0x' + BigInt(walletAddress).toString(16);

    return verify(signatureHex, msgHashHex, pubKeyHex);
  } catch (err) {
    console.error('[verifyRawMessageSignature] Error:', err);
    return false;
  }
}

/**
 * ✅ Verifies a typed data signature (ArgentX-style)
 */
export function verifyTypedDataSignature(
  address: string,
  typedData: any,
  signature: string[]
): boolean {
  try {
    // Ensure signature has exactly 2 elements (r, s)
    if (signature.length !== 2) {
      throw new Error('Signature must be an array of [r, s]');
    }

    // Convert to Signature object
    const sig = new Signature(
      BigInt(signature[0]),
      BigInt(signature[1])
    );

    // Convert to hex string
    const hexSig = bytesToHex(sig.toCompactRawBytes());

    return verify(address, typedData, hexSig);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}


