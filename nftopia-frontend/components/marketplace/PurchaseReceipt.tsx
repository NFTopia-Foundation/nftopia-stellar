"use client";

export type PurchaseReceiptData = {
  nftName: string;
  nftImage?: string;
  price: string;
  currency: string;
  platformFee?: string;
  networkFee?: string;
  royalty?: string;
  seller?: string;
  buyer?: string;
  timestamp: string;
  txHash?: string | null;
};

const explorerBase =
  process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL || "https://stellar.expert/explorer/testnet";

export function explorerTxUrl(txHash: string): string {
  return `${explorerBase}/tx/${txHash}`;
}

type Props = {
  receipt: PurchaseReceiptData;
  onClose?: () => void;
};

export function PurchaseReceipt({ receipt, onClose }: Props) {
  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div
      data-testid="purchase-receipt"
      className="rounded-xl border border-purple-900/40 bg-[#16132e] p-6 text-white print:border-0 print:bg-white print:text-black"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-purple-300 print:text-gray-600">
            Purchase receipt
          </p>
          <h3 className="mt-1 text-xl font-semibold">{receipt.nftName}</h3>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-sm text-gray-400 print:hidden">
            Close
          </button>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-400">Price</dt>
          <dd>
            {receipt.price} {receipt.currency}
          </dd>
        </div>
        {receipt.platformFee != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Platform fee</dt>
            <dd>
              {receipt.platformFee} {receipt.currency}
            </dd>
          </div>
        )}
        {receipt.networkFee != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Network fee</dt>
            <dd>
              {receipt.networkFee} {receipt.currency}
            </dd>
          </div>
        )}
        {receipt.royalty != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Royalty</dt>
            <dd>
              {receipt.royalty} {receipt.currency}
            </dd>
          </div>
        )}
        {receipt.seller && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Seller</dt>
            <dd className="truncate font-mono text-xs">{receipt.seller}</dd>
          </div>
        )}
        {receipt.buyer && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Buyer</dt>
            <dd className="truncate font-mono text-xs">{receipt.buyer}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-gray-400">Timestamp</dt>
          <dd>{receipt.timestamp}</dd>
        </div>
        {receipt.txHash && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400">Transaction</dt>
            <dd>
              <a
                data-testid="receipt-explorer-link"
                className="text-cyan-300 underline"
                href={explorerTxUrl(receipt.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                {receipt.txHash.slice(0, 8)}…{receipt.txHash.slice(-6)}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        data-testid="download-receipt-btn"
        onClick={handlePrint}
        className="mt-6 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-700 print:hidden"
      >
        Download / Print receipt
      </button>
    </div>
  );
}
