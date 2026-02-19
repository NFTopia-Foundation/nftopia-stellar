
import { Controller, Get, Param, Query } from '@nestjs/common';
import { NftService } from './nft.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('nfts')
@Controller('nfts')
export class NftController {
    constructor(private readonly nftService: NftService) { }

    @Get()
    @ApiOperation({ summary: 'List NFTs with filtering, sorting, and pagination' })
    @ApiResponse({ status: 200, description: 'List of NFTs.' })
    @ApiQuery({ name: 'contractId', required: false, description: 'Filter by contract ID' })
    @ApiQuery({ name: 'owner', required: false, description: 'Filter by owner G-address' })
    async findAll(@Query() query: any) {
        return this.nftService.findAll(query);
    }

    @Get('popular')
    @ApiOperation({ summary: 'Get Popular This Week NFTs' })
    async getPopular() {
        return this.nftService.getPopular();
    }

    @Get('top-sellers')
    @ApiOperation({ summary: 'Get Top Sellers analytics' })
    async getTopSellers() {
        return this.nftService.getTopSellers();
    }

    @Get(':contractId/:tokenId')
    @ApiOperation({ summary: 'Get specific NFT details' })
    async findOne(
        @Param('contractId') contractId: string,
        @Param('tokenId') tokenId: string,
    ) {
        return this.nftService.findOne(contractId, tokenId);
    }
}
