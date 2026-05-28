import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Offer } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferStatus } from './interfaces/offer.interface';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';
import { UsersService } from '../../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(StellarNft)
    private readonly nftRepo: Repository<StellarNft>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly settlementClient: MarketplaceSettlementClient,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateOfferDto, bidderId: string): Promise<Offer> {
    const currency = dto.currency ?? 'XLM';
    if (currency !== 'XLM') {
      throw new BadRequestException('Only XLM offers are supported');
    }

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Verify the NFT exists and find its current owner
    const nft = await this.nftRepo.findOne({
      where: { contractId: dto.nftContractId, tokenId: dto.nftTokenId },
    });
    if (!nft) throw new NotFoundException('NFT not found');

    // Look up the NFT owner's user account by their Stellar address
    const ownerUser = await this.usersService.findByStellarAddress(nft.owner);
    if (!ownerUser) {
      throw new NotFoundException(
        'NFT owner does not have a registered account',
      );
    }

    if (ownerUser.id === bidderId) {
      throw new BadRequestException('You cannot make an offer on your own NFT');
    }

    // Prevent duplicate pending offers from the same bidder for the same NFT
    const existing = await this.offerRepo.findOne({
      where: {
        bidderId,
        nftContractId: dto.nftContractId,
        nftTokenId: dto.nftTokenId,
        status: OfferStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending offer for this NFT',
      );
    }

    const offer = this.offerRepo.create({
      bidderId,
      ownerId: ownerUser.id,
      nftContractId: dto.nftContractId,
      nftTokenId: dto.nftTokenId,
      amount: dto.amount,
      currency,
      expiresAt,
      status: OfferStatus.PENDING,
    });

    const saved = await this.offerRepo.save(offer);

    // Notify the NFT owner about the new offer
    this.notificationsService.notifyUser(
      ownerUser.id,
      'offer.received',
      'New Offer Received',
      `You received an offer of ${dto.amount} XLM for your NFT`,
      {
        offerId: saved.id,
        nftContractId: dto.nftContractId,
        nftTokenId: dto.nftTokenId,
        amount: dto.amount,
      },
    );

    this.logger.log(
      `Offer created: id=${saved.id} bidder=${bidderId} owner=${ownerUser.id} nft=${dto.nftContractId}:${dto.nftTokenId} amount=${dto.amount} XLM`,
    );

    return saved;
  }

  async findByNft(nftContractId: string, nftTokenId: string): Promise<Offer[]> {
    return this.offerRepo
      .createQueryBuilder('o')
      .where('o.nftContractId = :nftContractId', { nftContractId })
      .andWhere('o.nftTokenId = :nftTokenId', { nftTokenId })
      .andWhere('o.status = :status', { status: OfferStatus.PENDING })
      .andWhere('o.expiresAt > :now', { now: new Date() })
      .orderBy('o.amount', 'DESC')
      .addOrderBy('o.createdAt', 'ASC')
      .getMany();
  }

  async accept(
    offerId: string,
    callerId: string,
  ): Promise<{ offer: Offer; transactionXdr?: string }> {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');

    if (offer.ownerId !== callerId) {
      throw new ForbiddenException('Only the NFT owner can accept this offer');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(
        `Offer is not in PENDING state (current: ${offer.status})`,
      );
    }

    if (offer.expiresAt <= new Date()) {
      // Mark expired and save before throwing
      offer.status = OfferStatus.EXPIRED;
      await this.offerRepo.save(offer);
      throw new BadRequestException('This offer has expired');
    }

    let transactionXdr: string | undefined;

    const enableOnchain = this.configService.get<boolean>(
      'ENABLE_ONCHAIN_SETTLEMENT',
    );
    if (enableOnchain) {
      try {
        transactionXdr = await this.settlementClient.acceptOffer({
          offerId: offer.id,
          owner: callerId,
          bidder: offer.bidderId,
          nftContractId: offer.nftContractId,
          nftTokenId: offer.nftTokenId,
          amount: String(offer.amount),
          currency: offer.currency,
        });
      } catch (err) {
        this.logger.error('Failed to build accept_offer transaction', err);
        throw err;
      }
    }

    offer.status = OfferStatus.ACCEPTED;
    if (transactionXdr) offer.txHash = transactionXdr;
    const saved = await this.offerRepo.save(offer);

    // Expire all other pending offers for the same NFT since it's now sold
    await this.offerRepo
      .createQueryBuilder()
      .update(Offer)
      .set({ status: OfferStatus.EXPIRED })
      .where('nftContractId = :nftContractId', {
        nftContractId: offer.nftContractId,
      })
      .andWhere('nftTokenId = :nftTokenId', { nftTokenId: offer.nftTokenId })
      .andWhere('id != :id', { id: offerId })
      .andWhere('status = :status', { status: OfferStatus.PENDING })
      .execute();

    // Notify the bidder about accepted offer
    this.notificationsService.notifyUser(
      offer.bidderId,
      'offer.accepted',
      'Your Offer Was Accepted',
      `Your offer of ${offer.amount} XLM has been accepted`,
      {
        offerId: saved.id,
        nftContractId: offer.nftContractId,
        nftTokenId: offer.nftTokenId,
        transactionXdr,
      },
    );

    this.logger.log(
      `Offer accepted: id=${offerId} owner=${callerId} bidder=${offer.bidderId}`,
    );

    return { offer: saved, transactionXdr };
  }

  async cancel(offerId: string, callerId: string): Promise<Offer> {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');

    if (offer.bidderId !== callerId) {
      throw new ForbiddenException('Only the offer creator can cancel it');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(
        `Offer cannot be cancelled (current: ${offer.status})`,
      );
    }

    offer.status = OfferStatus.CANCELLED;
    return this.offerRepo.save(offer);
  }

  async findOne(offerId: string): Promise<Offer> {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }
}
