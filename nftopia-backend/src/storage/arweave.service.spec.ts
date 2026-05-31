import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Arweave from 'arweave';
import { ArweaveService } from './arweave.service';
import type { UploadedFile } from './storage.types';

const createFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => {
  const buffer = overrides.buffer ?? Buffer.from('nftopia-arweave-file');

  return {
    originalname: 'asset.png',
    mimetype: 'image/png',
    ...overrides,
    buffer,
    size: overrides.size ?? buffer.length,
  };
};

describe('ArweaveService', () => {
  let service: ArweaveService;
  let configValues: Record<string, string>;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configValues = {
      ARWEAVE_HOST: 'arweave.net',
      ARWEAVE_PORT: '443',
      ARWEAVE_PROTOCOL: 'https',
      ARWEAVE_GATEWAY_URL: 'https://arweave.net',
      ARWEAVE_WALLET_JWK: JSON.stringify({
        kty: 'RSA',
        n: 'test-n',
        e: 'AQAB',
      }),
    };

    configService = {
      get: jest.fn((key: string) => configValues[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArweaveService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<ArweaveService>(ArweaveService);
  });

  describe('upload', () => {
    it('should throw ServiceUnavailableException when Arweave upload fails', async () => {
      configValues.ARWEAVE_WALLET_JWK = JSON.stringify({
        kty: 'RSA',
        n: 'test-n',
        e: 'AQAB',
      });

      const file = createFile();

      // Mock Arweave client to throw error
      jest.spyOn(service as any, 'getArweaveClient').mockReturnValue({
        createTransaction: jest.fn().mockRejectedValue(new Error('Network error')),
      });

      await expect(service.upload(file)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException with sanitized message', async () => {
      configValues.ARWEAVE_WALLET_JWK = JSON.stringify({
        kty: 'RSA',
        n: 'test-n',
        e: 'AQAB',
      });

      const file = createFile();

      jest.spyOn(service as any, 'getArweaveClient').mockReturnValue({
        createTransaction: jest.fn().mockRejectedValue(new Error('Network error')),
      });

      try {
        await service.upload(file);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect((error as ServiceUnavailableException).message).toBe(
          'Failed to upload to Arweave. Please try again later.',
        );
        expect((error as ServiceUnavailableException).message).not.toContain(
          'Network error',
        );
      }
    });
  });

  describe('getWalletJwk', () => {
    it('should throw InternalServerErrorException when wallet not configured', async () => {
      configValues.ARWEAVE_WALLET_JWK = '';
      configValues.ARWEAVE_WALLET_PATH = '';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ArweaveService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithoutWallet = module.get<ArweaveService>(ArweaveService);

      await expect(
        (serviceWithoutWallet as any).getWalletJwk(),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException with sanitized message when wallet not configured', async () => {
      configValues.ARWEAVE_WALLET_JWK = '';
      configValues.ARWEAVE_WALLET_PATH = '';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ArweaveService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithoutWallet = module.get<ArweaveService>(ArweaveService);

      try {
        await (serviceWithoutWallet as any).getWalletJwk();
        fail('Should have thrown InternalServerErrorException');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect((error as InternalServerErrorException).message).toBe(
          'Arweave wallet not configured. Please contact support.',
        );
        expect((error as InternalServerErrorException).message).not.toContain(
          'ARWEAVE_WALLET_JWK',
        );
        expect((error as InternalServerErrorException).message).not.toContain(
          'ARWEAVE_WALLET_PATH',
        );
      }
    });

    it('should throw BadRequestException when wallet JSON is invalid', async () => {
      configValues.ARWEAVE_WALLET_JWK = 'invalid-json';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ArweaveService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithInvalidWallet = module.get<ArweaveService>(
        ArweaveService,
      );

      await expect(
        (serviceWithInvalidWallet as any).getWalletJwk(),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException with sanitized message when wallet JSON is invalid', async () => {
      configValues.ARWEAVE_WALLET_JWK = 'invalid-json';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ArweaveService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithInvalidWallet = module.get<ArweaveService>(
        ArweaveService,
      );

      try {
        await (serviceWithInvalidWallet as any).getWalletJwk();
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Invalid Arweave wallet configuration',
        );
        expect((error as BadRequestException).message).not.toContain(
          'JSON',
        );
      }
    });

    it('should parse valid wallet JSON successfully', async () => {
      configValues.ARWEAVE_WALLET_JWK = JSON.stringify({
        kty: 'RSA',
        n: 'test-n',
        e: 'AQAB',
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ArweaveService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceWithValidWallet = module.get<ArweaveService>(
        ArweaveService,
      );

      const wallet = await (serviceWithValidWallet as any).getWalletJwk();
      expect(wallet).toEqual({
        kty: 'RSA',
        n: 'test-n',
        e: 'AQAB',
      });
    });
  });
});
