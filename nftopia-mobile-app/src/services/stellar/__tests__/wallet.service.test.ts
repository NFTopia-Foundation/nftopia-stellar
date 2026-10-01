import { Account, Horizon, Keypair } from 'stellar-sdk';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn().mockResolvedValue('mockedhash'),
}));

jest.mock('stellar-hd-wallet', () => {
  const { Keypair: KP } = require('stellar-sdk');
  const mockKeypair = KP.random();
  return {
    __esModule: true,
    default: {
      generateMnemonic: jest.fn().mockReturnValue(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      ),
      fromMnemonic: jest.fn().mockReturnValue({
        getKeypair: jest.fn().mockReturnValue(mockKeypair),
      }),
    },
  };
});

import { StellarWalletService } from '../wallet.service';
import { SecureStorage } from '../secureStorage';
import { WalletError, WalletErrorCode } from '../types';

const VALID_SECRET_KEY = Keypair.random().secret();
const VALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function makeMockStorage(): jest.Mocked<SecureStorage> {
  return {
    saveWallet: jest.fn().mockResolvedValue(undefined),
    getWallet: jest.fn(),
    deleteWallet: jest.fn().mockResolvedValue(undefined),
    hasWallet: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<SecureStorage>;
}

describe('StellarWalletService', () => {
  let service: StellarWalletService;
  let mockStorage: jest.Mocked<SecureStorage>;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    service = new StellarWalletService(mockStorage);
  });

  describe('createWallet', () => {
    it('creates a wallet with valid public and secret keys', async () => {
      const result = await service.createWallet();
      expect(result.wallet.publicKey).toBeTruthy();
      expect(result.wallet.secretKey).toBeTruthy();
      expect(service.isValidSecretKey(result.wallet.secretKey)).toBe(true);
    });

    it('saves the wallet to storage', async () => {
      await service.createWallet();
      expect(mockStorage.saveWallet).toHaveBeenCalledTimes(1);
    });

    it('passes password to storage when provided', async () => {
      await service.createWallet('my-password');
      expect(mockStorage.saveWallet).toHaveBeenCalledWith(expect.any(Object), 'my-password');
    });
  });

  describe('importFromSecretKey', () => {
    it('imports a wallet from a valid secret key', async () => {
      const wallet = await service.importFromSecretKey(VALID_SECRET_KEY);
      expect(wallet.secretKey).toBe(VALID_SECRET_KEY);
      expect(wallet.publicKey).toBe(service.getPublicKey(VALID_SECRET_KEY));
    });

    it('throws WalletError for an invalid secret key', async () => {
      await expect(service.importFromSecretKey('bad-key')).rejects.toThrow(WalletError);
      await expect(service.importFromSecretKey('bad-key')).rejects.toMatchObject({
        code: WalletErrorCode.INVALID_SECRET_KEY,
      });
    });

    it('saves the wallet to storage', async () => {
      await service.importFromSecretKey(VALID_SECRET_KEY);
      expect(mockStorage.saveWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe('importFromMnemonic', () => {
    it('imports a wallet from a valid mnemonic', async () => {
      const wallet = await service.importFromMnemonic(VALID_MNEMONIC);
      expect(wallet.publicKey).toBeTruthy();
      expect(wallet.secretKey).toBeTruthy();
      expect(wallet.mnemonic).toBe(VALID_MNEMONIC);
    });

    it('throws WalletError for an invalid mnemonic', async () => {
      await expect(service.importFromMnemonic('too short')).rejects.toThrow(WalletError);
      await expect(service.importFromMnemonic('too short')).rejects.toMatchObject({
        code: WalletErrorCode.INVALID_MNEMONIC,
      });
    });

    it('saves the wallet to storage', async () => {
      await service.importFromMnemonic(VALID_MNEMONIC);
      expect(mockStorage.saveWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe('signMessage', () => {
    it('returns a base64-encoded signature', async () => {
      const signature = await service.signMessage('hello', VALID_SECRET_KEY);
      expect(typeof signature).toBe('string');
      expect(Buffer.from(signature, 'base64').length).toBeGreaterThan(0);
    });

    it('throws WalletError for an invalid secret key', async () => {
      await expect(service.signMessage('hello', 'bad-key')).rejects.toThrow(WalletError);
      await expect(service.signMessage('hello', 'bad-key')).rejects.toMatchObject({
        code: WalletErrorCode.INVALID_SECRET_KEY,
      });
    });
  });

  describe('getPublicKey', () => {
    it('returns the correct public key for a secret key', () => {
      const expectedPublicKey = Keypair.fromSecret(VALID_SECRET_KEY).publicKey();
      expect(service.getPublicKey(VALID_SECRET_KEY)).toBe(expectedPublicKey);
    });

    it('throws WalletError for an invalid secret key', () => {
      expect(() => service.getPublicKey('bad-key')).toThrow(WalletError);
    });
  });

  describe('isValidSecretKey', () => {
    it('returns true for a valid key', () => {
      expect(service.isValidSecretKey(VALID_SECRET_KEY)).toBe(true);
    });

    it('returns false for an invalid key', () => {
      expect(service.isValidSecretKey('bad-key')).toBe(false);
    });
  });

  describe('isValidMnemonic', () => {
    it('returns true for a valid mnemonic', () => {
      expect(service.isValidMnemonic(VALID_MNEMONIC)).toBe(true);
    });

    it('returns false for an invalid mnemonic', () => {
      expect(service.isValidMnemonic('too short')).toBe(false);
    });
  });

  describe('fee estimation and reserve checks (#471)', () => {
    // A real stellar-sdk Account gives TransactionBuilder everything it
    // needs (accountId/sequenceNumber/incrementSequenceNumber); the extra
    // Horizon-only fields (balances, subentry_count) are attached on top,
    // mirroring what loadAccount() actually returns.
    function makeAccount(nativeBalanceXlm: string, subentryCount = 0) {
      const account = new Account(Keypair.random().publicKey(), '1');
      return Object.assign(account, {
        balances: [{ asset_type: 'native', balance: nativeBalanceXlm }],
        subentry_count: subentryCount,
      });
    }

    function makeServer(overrides: Record<string, jest.Mock> = {}) {
      return {
        loadAccount: jest.fn().mockResolvedValue(makeAccount('1000')),
        feeStats: jest.fn(),
        fetchBaseFee: jest.fn().mockResolvedValue(100),
        submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx-hash' }),
        ...overrides,
      };
    }

    function makeFeeStatsResponse(mode = '100'): Horizon.HorizonApi.FeeStatsResponse {
      const distribution: Horizon.HorizonApi.FeeDistribution = {
        max: '10000', min: '100', mode, p10: '100', p20: '100', p30: '100',
        p40: '100', p50: mode, p60: '150', p70: '200', p80: '500', p90: '1000',
        p95: '2000', p99: '5000',
      };
      return {
        last_ledger: '1',
        last_ledger_base_fee: '100',
        ledger_capacity_usage: '0.5',
        fee_charged: distribution,
        max_fee: distribution,
      };
    }

    describe('estimateFee', () => {
      it('uses live fee stats when available, and is not marked degraded', async () => {
        const server = makeServer({ feeStats: jest.fn().mockResolvedValue(makeFeeStatsResponse('250')) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        const estimate = await svc.estimateFee(['Send Payment']);

        expect(estimate.degraded).toBe(false);
        expect(estimate.feePerOperationStroops).toBe('250');
        expect(server.feeStats).toHaveBeenCalledTimes(1);
      });

      it('falls back to fetchBaseFee and marks the estimate degraded when feeStats() fails', async () => {
        const server = makeServer({
          feeStats: jest.fn().mockRejectedValue(new Error('feeStats unavailable')),
          fetchBaseFee: jest.fn().mockResolvedValue(321),
        });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        const estimate = await svc.estimateFee(['Send Payment']);

        expect(estimate.degraded).toBe(true);
        expect(estimate.feePerOperationStroops).toBe('321');
      });

      it('falls back to the hardcoded network minimum when both feeStats and fetchBaseFee fail', async () => {
        const server = makeServer({
          feeStats: jest.fn().mockRejectedValue(new Error('down')),
          fetchBaseFee: jest.fn().mockRejectedValue(new Error('also down')),
        });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        const estimate = await svc.estimateFee(['Send Payment']);

        expect(estimate.degraded).toBe(true);
        expect(estimate.feePerOperationStroops).toBe('100');
      });

      it('multiplies correctly across a multi-operation transaction', async () => {
        const server = makeServer({ feeStats: jest.fn().mockResolvedValue(makeFeeStatsResponse('100')) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        const estimate = await svc.estimateFee(['Add Trustline', 'Send Payment']);

        expect(estimate.operationCount).toBe(2);
        expect(estimate.totalFeeStroops).toBe('200');
        expect(estimate.breakdown).toHaveLength(2);
      });

      it('honors a custom fee override for advanced users', async () => {
        const server = makeServer({ feeStats: jest.fn().mockResolvedValue(makeFeeStatsResponse('100')) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        const estimate = await svc.estimateFee(['Send Payment'], { customFeePerOperationStroops: '999' });

        expect(estimate.feePerOperationStroops).toBe('999');
      });
    });

    describe('getAccountReserveInfo', () => {
      it('returns native balance in stroops and the subentry count', async () => {
        const server = makeServer({ loadAccount: jest.fn().mockResolvedValue(makeAccount('42.5', 3)) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        const info = await svc.getAccountReserveInfo(Keypair.random().publicKey());

        expect(info.nativeBalanceStroops).toBe('425000000');
        expect(info.subentryCount).toBe(3);
      });

      it('throws WalletError(NETWORK_ERROR) when the account can\'t be loaded', async () => {
        const server = makeServer({ loadAccount: jest.fn().mockRejectedValue(new Error('not found')) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);

        await expect(svc.getAccountReserveInfo(Keypair.random().publicKey())).rejects.toMatchObject({
          code: WalletErrorCode.NETWORK_ERROR,
        });
      });
    });

    describe('sendPayment fee override and reserve enforcement', () => {
      it('uses feeOverrideStroops for the submitted transaction fee instead of fetchBaseFee', async () => {
        const server = makeServer();
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);
        const destination = Keypair.random().publicKey();

        await svc.sendPayment(VALID_SECRET_KEY, destination, '10', 'XLM', undefined, undefined, '777');

        expect(server.fetchBaseFee).not.toHaveBeenCalled();
        const [submittedTx] = server.submitTransaction.mock.calls[0] as [{ fee: string }];
        expect(submittedTx.fee).toBe('777');
      });

      it('falls back to fetchBaseFee when no override is given', async () => {
        const server = makeServer({ fetchBaseFee: jest.fn().mockResolvedValue(150) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);
        const destination = Keypair.random().publicKey();

        await svc.sendPayment(VALID_SECRET_KEY, destination, '10');

        const [submittedTx] = server.submitTransaction.mock.calls[0] as [{ fee: string }];
        expect(submittedTx.fee).toBe('150');
      });

      it('blocks submission with INSUFFICIENT_RESERVE when the payment would breach the minimum reserve', async () => {
        // Balance sits right at the 1 XLM (0 subentries) reserve floor —
        // sending any amount at all must push it below that floor.
        const server = makeServer({ loadAccount: jest.fn().mockResolvedValue(makeAccount('1', 0)) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);
        const destination = Keypair.random().publicKey();

        await expect(svc.sendPayment(VALID_SECRET_KEY, destination, '0.5')).rejects.toMatchObject({
          code: WalletErrorCode.INSUFFICIENT_RESERVE,
        });
        expect(server.submitTransaction).not.toHaveBeenCalled();
      });

      it('does not block a payment that leaves the balance at or above the minimum reserve', async () => {
        const server = makeServer({ loadAccount: jest.fn().mockResolvedValue(makeAccount('100', 0)) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);
        const destination = Keypair.random().publicKey();

        await expect(svc.sendPayment(VALID_SECRET_KEY, destination, '10')).resolves.toEqual({ hash: 'tx-hash' });
      });

      it('only checks the reserve against the fee for a non-native asset payment (the sent amount is a different asset)', async () => {
        // Just above the 1 XLM (0 subentries) reserve floor — enough
        // headroom for the fee alone, but nowhere near enough to also
        // cover a native "10" if the amount were wrongly treated as XLM.
        // A non-native payment doesn't spend XLM beyond the fee, so this
        // should NOT be blocked (unlike the native-payment case above).
        const server = makeServer({ loadAccount: jest.fn().mockResolvedValue(makeAccount('1.001', 0)) });
        const svc = new StellarWalletService(undefined, 'testnet', server as unknown as Horizon.Server);
        const destination = Keypair.random().publicKey();
        const issuer = Keypair.random().publicKey();

        await expect(
          svc.sendPayment(VALID_SECRET_KEY, destination, '10', 'USDC', issuer),
        ).resolves.toEqual({ hash: 'tx-hash' });
      });
    });
  });
});
