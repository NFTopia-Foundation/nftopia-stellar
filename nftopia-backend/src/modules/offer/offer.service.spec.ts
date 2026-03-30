import { Test, TestingModule } from '@nestjs/testing';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/offer.dto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Offer, OfferStatus } from './entities/offer.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockOfferRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockImplementation((dto: any) => dto as Offer),
  save: jest.fn().mockImplementation((a: Offer) => Promise.resolve(a)),
};

const mockNftRepo = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'STELLAR_HORIZON_URL') return 'test_url';
    return null;
  }),
};

// Mock Stellar SDK
jest.mock('stellar-sdk', () => {
  const mockAsset = jest.fn().mockImplementation((code: string, issuer: string) => ({
    code,
    issuer,
    isNative: () => false,
  }));
  
  const mockAssetStatic = mockAsset as jest.MockedFunction<typeof mockAsset> & {
    native: jest.Mock;
  };
  mockAssetStatic.native = jest.fn(() => ({ isNative: () => true }));

  return {
    Asset: mockAsset,
    Networks: { TESTNET: 'testnet' },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ toXDR: () => 'mock_xdr' }),
    })),
    Operation: {
      payment: jest.fn(),
    },
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          balances: [{ asset_type: 'native', balance: '100' }],
        }),
      })),
    },
    BASE_FEE: '100',
  };
});

describe('OfferService', () => {
  let service: OfferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfferService,
        { provide: getRepositoryToken(Offer), useValue: mockOfferRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OfferService>(OfferService);
    jest.clearAllMocks();
  });

  describe('createOffer', () => {
    it('creates an offer successfully', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce({
        contractId: 'C1',
        tokenId: 'T1',
        owner: 'owner1',
      });

      const res = await service.createOffer({
        nftId: 'C1:T1',
        amount: 10,
        currency: 'XLM',
        expiresAt: new Date(Date.now() + 10000).toISOString(),
        bidderPublicKey: 'bidder1',
      });

      expect(res.bidderId).toBe('bidder1');
      expect(mockOfferRepo.save).toHaveBeenCalled();
    });

    it('fails if NFT does not exist', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createOffer({
          nftId: 'C1:T1',
          amount: 10,
          expiresAt: '...',
          bidderPublicKey: 'b',
          nftTokenId: 'T1',
          currency: 'XLM',
        } as CreateOfferDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptOffer', () => {
    it('returns XDR when accepted by owner', async () => {
      const offer = {
        id: 'o1',
        bidderId: 'b1',
        ownerId: 'owner1',
        amount: 10,
        currency: 'XLM',
        status: OfferStatus.PENDING,
        nftContractId: 'C1',
        nftTokenId: 'T1',
        expiresAt: new Date(Date.now() + 10000),
      } as Offer;

      mockOfferRepo.findOne.mockResolvedValueOnce(offer);

      const res = await service.acceptOffer('o1', 'owner1');
      expect(res.xdr).toBe('mock_xdr');
      expect(offer.status).toBe(OfferStatus.ACCEPTED);
    });

    it('fails if offer is expired', async () => {
      const offer = {
        id: 'o1',
        status: OfferStatus.PENDING,
        expiresAt: new Date(Date.now() - 10000),
      } as Offer;
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);

      await expect(service.acceptOffer('o1', 'any')).rejects.toThrow(
        BadRequestException,
      );
      expect(offer.status).toBe(OfferStatus.EXPIRED);
    });
  });
});
