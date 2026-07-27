import { NetworkType } from '@/stores/walletStore';
import { createServer } from './network';

export interface TokenBalance {
  asset_code: string;
  asset_issuer: string;
  balance: string;
  asset_type: string;
}

export async function fetchXlmBalance(
  publicKey: string,
  network: NetworkType,
): Promise<string> {
  const server = createServer(network);
  const account = await server.loadAccount(publicKey);
  const xlmBalance = account.balances.find((b: any) => b.asset_type === 'native');
  return xlmBalance ? xlmBalance.balance : '0';
}

export async function fetchTokenBalances(
  publicKey: string,
  network: NetworkType,
): Promise<TokenBalance[]> {
  const server = createServer(network);
  const account = await server.loadAccount(publicKey);
  return account.balances
    .filter((b: any) => b.asset_type !== 'native')
    .map((b: any) => ({
      asset_code: b.asset_code ?? 'XLM',
      asset_issuer: b.asset_issuer ?? '',
      balance: b.balance,
      asset_type: b.asset_type,
    }));
}
