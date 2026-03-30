import { StellarNetwork } from "@/types/stellar";

async function getAlbedo() {
  if (typeof window === "undefined") {
    throw new Error("Albedo is only available in the browser");
  }
  const albedo = await import("@albedo-link/intent");
  return albedo.default || albedo;
}

export async function connectAlbedo(): Promise<string> {
  const albedo = await getAlbedo();
  const result = await albedo.publicKey({
    require_existing: false,
  });

  if (!result?.pubkey) {
    throw new Error("Failed to get public key from Albedo");
  }

  return result.pubkey;
}

export async function signWithAlbedo(
  transactionXdr: string,
  network: StellarNetwork
): Promise<string> {
  const albedo = await getAlbedo();

  const result = await albedo.tx({
    xdr: transactionXdr,
    network: network === "testnet" ? "testnet" : "public",
    submit: false,
  });

  if (!result?.signed_envelope_xdr) {
    throw new Error("Albedo did not return a signed transaction");
  }

  return result.signed_envelope_xdr;
}

export async function signMessageWithAlbedo(
  message: string
): Promise<{ signature: string; publicKey: string }> {
  const albedo = await getAlbedo();

  const result = await albedo.signMessage({
    message,
  });

  if (!result?.message_signature || !result?.pubkey) {
    throw new Error("Albedo message signing failed");
  }

  return {
    signature: result.message_signature,
    publicKey: result.pubkey,
  };
}