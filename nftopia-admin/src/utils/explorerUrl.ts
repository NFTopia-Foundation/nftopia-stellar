/**
 * Connects to the Stellar explorer and returns a URL for the given id.
 * @param id - transaction hash or account address
 * @param type - "tx" for transaction, "account" for account
 */
export function explorerUrl(id: string, type: 'tx' | 'account'): string {
  if (type === 'account') {
    return `https://stellar.expert/explorer/public/account/${id}`
  }
  return `https://stellar.expert/explorer/public/tx/${id}`
}
