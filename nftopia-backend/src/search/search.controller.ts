import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService, SearchResult } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search across NFTs and users' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'type', required: false, enum: ['nfts', 'users', 'all'] })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'owner', required: false })
  @ApiQuery({ name: 'filter', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async search(@Query() query: SearchQueryDto): Promise<SearchResult> {
    const sortArr = query.sort ? [query.sort] : undefined;
    return this.searchService.search({
      q: query.q,
      type: query.type,
      contractId: query.contractId,
      owner: query.owner,
      filter: query.filter,
      sort: sortArr,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
