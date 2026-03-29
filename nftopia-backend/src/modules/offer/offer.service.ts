import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Asset,
  Networks,
  TransactionBuilder,
  Operation,
  Horizon,
  BASE_FEE,
} from 'stellar-sdk';
import { Offer, OfferStatus } from './entities/offer.entity';
import { CreateOfferDto } from './dto/offer.dto';
import { StellarNft } from '../../nft/entities/stellar-nft.entity';

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(StellarNft)
    private readonly nftRepo: Repository<StellarNft>,
    private readonly configService: ConfigService,
  ) {}

  async createOffer(dto: CreateOfferDto): Promise<Offer> {
    const { nftId, nftTokenId, amount, currency, expiresAt, bidderPublicKey } =
      dto;

    // Check if NFT exists
    const nftToken = nftTokenId || nftId.split(':')[1];
    const nftContract = nftId.split(':')[0];

    const nft = await this.nftRepo.findOne({
      where: { contractId: nftContract, tokenId: nftToken },
    });
    if (!nft) {
      throw new NotFoundException(`NFT ${nftContract}:${nftToken} not found`);
    }

    if (nft.owner === bidderPublicKey) {
      throw new BadRequestException('You cannot make an offer on your own NFT');
    }

    // Validate balance
    await this.verifyBalance(bidderPublicKey, amount, currency || 'XLM');

    const offer = this.offerRepo.create({
      bidderId: bidderPublicKey,
      ownerId: nft.owner,
      nftContractId: nftContract,
      nftTokenId: nftToken,
      amount,
      currency: currency || 'XLM',
      expiresAt: new Date(expiresAt),
      status: OfferStatus.PENDING,
    });

    return this.offerRepo.save(offer);
  }

  async getOffersByNft(contractId: string, tokenId: string): Promise<Offer[]> {
    return this.offerRepo.find({
      where: {
        nftContractId: contractId,
        nftTokenId: tokenId,
        status: OfferStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async acceptOffer(
    offerId: string,
    ownerPublicKey: string,
  ): Promise<{ xdr: string; offer: Offer }> {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Offer not found');

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(`Offer is ${offer.status}`);
    }

    if (offer.expiresAt && new Date(offer.expiresAt) <= new Date()) {
      offer.status = OfferStatus.EXPIRED;
      await this.offerRepo.save(offer);
      throw new BadRequestException('Offer has expired');
    }

    if (offer.ownerId !== ownerPublicKey) {
      throw new ForbiddenException(
        'Only the current owner can accept this offer',
      );
    }

    // Verify current balance of bidder again (escrow check)
    await this.verifyBalance(offer.bidderId, offer.amount, offer.currency);

    // Build Stellar Transaction Envelope (Binding Swap)
    const xdr = await this.buildSwapXdr(offer);

    offer.status = OfferStatus.ACCEPTED;
    await this.offerRepo.save(offer);

    return { xdr, offer };
  }

  private async verifyBalance(
    publicKey: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    const server = new Horizon.Server(horizonUrl);

    try {
      const account = await server.loadAccount(publicKey);
      let balance = '0';

      if (currency.toUpperCase() === 'XLM') {
        const native = account.balances.find((b) => b.asset_type === 'native');
        balance = native?.balance || '0';
      } else {
        // Find asset balance for wETH or others
        const asset = account.balances.find(
          (b) => 'asset_code' in b && b.asset_code === currency.toUpperCase(),
        );
        balance = asset?.balance || '0';
      }

      const available = parseFloat(balance);
      if (available < amount) {
        throw new BadRequestException(
          `Insufficient ${currency} balance. Available: ${available}, Required: ${amount}`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `Balance check failed for ${publicKey}: ${(err as Error).message}`,
      );
      // In a real production app, you might want to fail harder if Horizon is down.
    }
  }

  private async buildSwapXdr(offer: Offer): Promise<string> {
    const horizonUrl =
      this.configService.get<string>('STELLAR_HORIZON_URL') ||
      'https://horizon-testnet.stellar.org';
    const networkPassphrase =
      this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      Networks.TESTNET;

    const server = new Horizon.Server(horizonUrl);
    const bidderAccount = await server.loadAccount(offer.bidderId);

    const assetToPay =
      offer.currency.toUpperCase() === 'XLM'
        ? Asset.native()
        : new Asset(
            offer.currency.toUpperCase(),
            this.configService.get<string>(
              `${offer.currency.toUpperCase()}_ISSUER`,
            ) || 'GBDEVG6LV7D6S6E5D7V5S6E5D7V5S6E5D7V5S6E5D7V5S6E5D7V5S6E5', // Placeholder
          );

    // NFT Asset Logic
    // In this implementation, we assume NFT is a Classic Stellar Asset.
    // Real NFTs might be Soroban tokens.
    const nftAsset = new Asset(
      offer.nftTokenId.substring(0, 12),
      offer.nftContractId,
    );

    const tx = new TransactionBuilder(bidderAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: offer.ownerId,
          asset: assetToPay,
          amount: offer.amount.toFixed(7),
          source: offer.bidderId,
        }),
      )
      .addOperation(
        Operation.payment({
          destination: offer.bidderId,
          asset: nftAsset,
          amount: '1',
          source: offer.ownerId,
        }),
      )
      .setTimeout(30)
      .build();

    return tx.toXDR();
  }
}
