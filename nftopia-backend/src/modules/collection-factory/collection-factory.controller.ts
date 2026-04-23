import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CollectionFactoryService } from './collection-factory.service';
import { CreateFactoryCollectionDto } from './dto/create-factory-collection.dto';
import { MintTokenDto } from './dto/mint-token.dto';
import { BatchMintDto } from './dto/batch-mint.dto';
import { TransferTokenDto } from './dto/transfer-token.dto';
import { SetRoyaltyDto } from './dto/set-royalty.dto';

@Controller('collections')
export class CollectionFactoryController {
  constructor(
    private readonly collectionFactoryService: CollectionFactoryService,
  ) {}

  @Post('factory/create')
  async createCollection(@Body() body: CreateFactoryCollectionDto) {
    return this.collectionFactoryService.createCollection(body);
  }

  @Get('factory/count')
  async getCollectionCount() {
    return this.collectionFactoryService.getCollectionCount();
  }

  @Get('factory/:id/address')
  async getCollectionAddress(@Param('id', ParseIntPipe) id: number) {
    return this.collectionFactoryService.getCollectionAddress(id);
  }

  @Post(':address/mint')
  async mintToken(
    @Param('address') address: string,
    @Body() body: MintTokenDto,
  ) {
    return this.collectionFactoryService.mintToken(
      address,
      body.to,
      body.metadataUri,
      body.attributes,
    );
  }

  @Post(':address/batch-mint')
  async batchMint(
    @Param('address') address: string,
    @Body() body: BatchMintDto,
  ) {
    return this.collectionFactoryService.batchMint(
      address,
      body.recipients,
      body.uris,
    );
  }

  @Post(':address/transfer')
  async transferToken(
    @Param('address') address: string,
    @Body() body: TransferTokenDto,
  ) {
    return this.collectionFactoryService.transferToken(
      address,
      body.from,
      body.to,
      body.tokenId,
    );
  }

  @Post(':address/royalty')
  async setRoyalty(
    @Param('address') address: string,
    @Body() body: SetRoyaltyDto,
  ) {
    return this.collectionFactoryService.setRoyalty(
      address,
      body.recipient,
      body.percentage,
    );
  }
}
