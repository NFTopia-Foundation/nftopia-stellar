import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SorobanContractArg, SorobanService } from '../stellar/soroban.service';
import { CreateFactoryCollectionDto } from './dto/create-factory-collection.dto';

@Injectable()
export class CollectionFactoryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly sorobanService: SorobanService,
  ) {}

  async createCollection(config: CreateFactoryCollectionDto) {
    this.sorobanService.ensureValidAccountAddress(config.owner);

    if (config.royaltyRecipient) {
      this.sorobanService.ensureValidAccountAddress(config.royaltyRecipient);
    }

    const args: SorobanContractArg[] = [
      { type: 'string', value: config.name },
      { type: 'string', value: config.symbol },
      { type: 'address', value: config.owner },
      { type: 'string', value: config.metadataUri || '' },
      { type: 'address', value: config.royaltyRecipient || config.owner },
      {
        type: 'u32',
        value: Math.round((config.royaltyPercentage || 0) * 100),
      },
    ];

    return this.sorobanService.invokeContract(
      this.getFactoryContractId(),
      'create_collection',
      args,
      { submit: true },
    );
  }

  async getCollectionCount() {
    const result = await this.sorobanService.invokeContract(
      this.getFactoryContractId(),
      'get_collection_count',
      [],
      { submit: false },
    );

    return {
      count: Number(result.returnValue ?? 0),
      raw: result.returnValue,
    };
  }

  async getCollectionAddress(collectionId: number) {
    const result = await this.sorobanService.invokeContract(
      this.getFactoryContractId(),
      'get_collection_address',
      [{ type: 'u32', value: collectionId }],
      { submit: false },
    );

    const rawAddress = result.returnValue;
    const address = typeof rawAddress === 'string' ? rawAddress : '';

    return {
      collectionId,
      address,
      raw: rawAddress,
    };
  }

  async mintToken(
    collectionAddress: string,
    to: string,
    metadataUri: string,
    attributes?: Record<string, unknown>,
  ) {
    this.sorobanService.ensureValidContractAddress(collectionAddress);
    this.sorobanService.ensureValidAccountAddress(to);

    const args: SorobanContractArg[] = [
      { type: 'address', value: to },
      { type: 'string', value: metadataUri },
      { value: attributes || {} },
    ];

    return this.sorobanService.invokeContract(
      collectionAddress,
      'mint_token',
      args,
      {
        submit: true,
      },
    );
  }

  async batchMint(
    collectionAddress: string,
    recipients: string[],
    uris: string[],
  ) {
    this.sorobanService.ensureValidContractAddress(collectionAddress);

    if (recipients.length !== uris.length) {
      throw new BadRequestException(
        'recipients and uris must have identical lengths',
      );
    }

    recipients.forEach((recipient) => {
      this.sorobanService.ensureValidAccountAddress(recipient);
    });

    const args: SorobanContractArg[] = [{ value: recipients }, { value: uris }];

    return this.sorobanService.invokeContract(
      collectionAddress,
      'batch_mint',
      args,
      {
        submit: true,
      },
    );
  }

  async transferToken(
    collectionAddress: string,
    from: string,
    to: string,
    tokenId: string,
  ) {
    this.sorobanService.ensureValidContractAddress(collectionAddress);
    this.sorobanService.ensureValidAccountAddress(from);
    this.sorobanService.ensureValidAccountAddress(to);

    const args: SorobanContractArg[] = [
      { type: 'address', value: from },
      { type: 'address', value: to },
      { type: 'u64', value: tokenId },
    ];

    return this.sorobanService.invokeContract(
      collectionAddress,
      'transfer_token',
      args,
      {
        submit: true,
      },
    );
  }

  async setRoyalty(
    collectionAddress: string,
    recipient: string,
    percentage: number,
  ) {
    this.sorobanService.ensureValidContractAddress(collectionAddress);
    this.sorobanService.ensureValidAccountAddress(recipient);

    const args: SorobanContractArg[] = [
      { type: 'address', value: recipient },
      { type: 'u32', value: Math.round(percentage * 100) },
    ];

    return this.sorobanService.invokeContract(
      collectionAddress,
      'set_royalty',
      args,
      {
        submit: true,
      },
    );
  }

  private getFactoryContractId(): string {
    const contractId = this.configService.get<string>(
      'COLLECTION_FACTORY_CONTRACT_ID',
    );

    if (!contractId) {
      throw new BadRequestException(
        'COLLECTION_FACTORY_CONTRACT_ID is not configured',
      );
    }

    this.sorobanService.ensureValidContractAddress(contractId);
    return contractId;
  }
}
