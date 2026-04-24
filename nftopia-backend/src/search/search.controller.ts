import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Search NFTs and profiles with fuzzy matching, filters, and sorting',
  })
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('nfts')
  @ApiOperation({
    summary: 'Search NFTs with fuzzy matching, filters, and sorting',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query string for fuzzy matching against NFT fields',
  })
  async searchNfts(@Query() query: SearchQueryDto) {
    return this.searchService.search({ ...query, type: 'nfts' });
  }
}
