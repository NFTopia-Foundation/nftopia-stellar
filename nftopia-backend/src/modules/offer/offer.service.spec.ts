import { Test, TestingModule } from '@nestjs/testing';
import { OfferService } from './offer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Offer } from './entities/offer.entity';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { OfferStatus } from './interfaces/offer.interface';
import { CreateOfferDto } from './dto/create-offer.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';

// ─── Repository mocks ────────────────────────────────────────────────────────

const mockOfferRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest
    .fn()
    .mockImplementation((dto: Partial<Offer>) => dto as unknown as Offer),
  save: jest.fn().mockImplementation((o: Offer) => Promise.resolve(o)),
  createQueryBuilder: jest.fn(),
};

const mockNftRepo = {
  findOne: jest.fn(),
};

// ─── Service-dependency mocks ─────────────────────────────────────────────────

const mockUsersService = {
  findByStellarAddress: jest.fn(),
};

const mockNotificationsService = {
  notifyUser: jest.fn(),
};

const mockSettlementClient = {
  acceptOffer: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
    return undefined;
  }),
};

// ─── Query-builder factory ────────────────────────────────────────────────────

function createQbMock(result: unknown[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
    getMany: jest.fn().mockResolvedValue(result),
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BIDDER_ID = 'bidder-uuid-1';
const OWNER_ID = 'owner-uuid-1';
const NFT_CONTRACT = 'CABC123';
const NFT_TOKEN = 'token-1';

const mockNft = {
  contractId: NFT_CONTRACT,
  tokenId: NFT_TOKEN,
  owner: 'GSTELLARADDRESS',
};

const mockOwnerUser = {
  id: OWNER_ID,
  address: 'GSTELLARADDRESS',
};

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-uuid-1',
    bidderId: BIDDER_ID,
    ownerId: OWNER_ID,
    nftContractId: NFT_CONTRACT,
    nftTokenId: NFT_TOKEN,
    amount: 100,
    currency: 'XLM',
    expiresAt: new Date(Date.now() + 86_400_000),
    status: OfferStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Offer;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('OfferService', () => {
  let service: OfferService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'ENABLE_ONCHAIN_SETTLEMENT') return false;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfferService,
        { provide: getRepositoryToken(Offer), useValue: mockOfferRepo },
        { provide: getRepositoryToken(StellarNft), useValue: mockNftRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        {
          provide: MarketplaceSettlementClient,
          useValue: mockSettlementClient,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OfferService>(OfferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto: CreateOfferDto = {
      nftContractId: NFT_CONTRACT,
      nftTokenId: NFT_TOKEN,
      amount: 100,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };

    it('should create an offer with valid inputs', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce(mockNft);
      mockUsersService.findByStellarAddress.mockResolvedValueOnce(
        mockOwnerUser,
      );
      mockOfferRepo.findOne.mockResolvedValueOnce(null);
      const saved = makeOffer();
      mockOfferRepo.save.mockResolvedValueOnce(saved);

      const result = await service.create(validDto, BIDDER_ID);

      expect(result).toEqual(saved);
      expect(mockOfferRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bidderId: BIDDER_ID,
          ownerId: OWNER_ID,
          amount: 100,
          currency: 'XLM',
          status: OfferStatus.PENDING,
        }),
      );
      expect(mockNotificationsService.notifyUser).toHaveBeenCalledWith(
        OWNER_ID,
        'offer.received',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ amount: 100 }),
      );
    });

    it('should reject if NFT not found', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.create(validDto, BIDDER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject if NFT owner has no account', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce(mockNft);
      mockUsersService.findByStellarAddress.mockResolvedValueOnce(null);

      await expect(service.create(validDto, BIDDER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject if bidder tries to offer on own NFT', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce(mockNft);
      mockUsersService.findByStellarAddress.mockResolvedValueOnce(
        mockOwnerUser,
      );

      // Bidder is the same as owner
      await expect(service.create(validDto, OWNER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject a duplicate pending offer from same bidder', async () => {
      mockNftRepo.findOne.mockResolvedValueOnce(mockNft);
      mockUsersService.findByStellarAddress.mockResolvedValueOnce(
        mockOwnerUser,
      );
      mockOfferRepo.findOne.mockResolvedValueOnce(makeOffer()); // existing offer

      await expect(service.create(validDto, BIDDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject currency other than XLM', async () => {
      const dto = { ...validDto, currency: 'USDC' };
      await expect(service.create(dto, BIDDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if expiration is in the past', async () => {
      const dto = {
        ...validDto,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      await expect(service.create(dto, BIDDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── findByNft ─────────────────────────────────────────────────────────────

  describe('findByNft', () => {
    it('should return pending non-expired offers', async () => {
      const offers = [makeOffer()];
      mockOfferRepo.createQueryBuilder.mockReturnValue(createQbMock(offers));

      const result = await service.findByNft(NFT_CONTRACT, NFT_TOKEN);
      expect(result).toEqual(offers);
    });
  });

  // ── accept ────────────────────────────────────────────────────────────────

  describe('accept', () => {
    it('should accept a valid pending offer', async () => {
      const offer = makeOffer();
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);
      mockOfferRepo.save.mockResolvedValueOnce({
        ...offer,
        status: OfferStatus.ACCEPTED,
      });
      mockOfferRepo.createQueryBuilder.mockReturnValue(createQbMock([]));

      const result = await service.accept('offer-uuid-1', OWNER_ID);

      expect(result.offer.status).toBe(OfferStatus.ACCEPTED);
      expect(mockNotificationsService.notifyUser).toHaveBeenCalledWith(
        BIDDER_ID,
        'offer.accepted',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when offer does not exist', async () => {
      mockOfferRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.accept('non-existent', OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if caller is not the NFT owner', async () => {
      const offer = makeOffer();
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);

      await expect(
        service.accept('offer-uuid-1', 'stranger-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when accepting an expired offer', async () => {
      const expiredOffer = makeOffer({
        expiresAt: new Date(Date.now() - 1000),
      });
      mockOfferRepo.findOne.mockResolvedValueOnce(expiredOffer);
      mockOfferRepo.save.mockResolvedValueOnce({
        ...expiredOffer,
        status: OfferStatus.EXPIRED,
      });

      await expect(service.accept('offer-uuid-1', OWNER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when offer is already accepted', async () => {
      const acceptedOffer = makeOffer({ status: OfferStatus.ACCEPTED });
      mockOfferRepo.findOne.mockResolvedValueOnce(acceptedOffer);

      await expect(service.accept('offer-uuid-1', OWNER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel a pending offer by its creator', async () => {
      const offer = makeOffer();
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);
      mockOfferRepo.save.mockResolvedValueOnce({
        ...offer,
        status: OfferStatus.CANCELLED,
      });

      const result = await service.cancel('offer-uuid-1', BIDDER_ID);
      expect(result.status).toBe(OfferStatus.CANCELLED);
    });

    it('should throw ForbiddenException if caller is not the bidder', async () => {
      const offer = makeOffer();
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);

      await expect(
        service.cancel('offer-uuid-1', 'stranger-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if offer is not PENDING', async () => {
      const offer = makeOffer({ status: OfferStatus.ACCEPTED });
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);

      await expect(service.cancel('offer-uuid-1', BIDDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the offer when found', async () => {
      const offer = makeOffer();
      mockOfferRepo.findOne.mockResolvedValueOnce(offer);

      const result = await service.findOne('offer-uuid-1');
      expect(result).toEqual(offer);
    });

    it('should throw NotFoundException when not found', async () => {
      mockOfferRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
