import { Controller, Get, Param } from '@nestjs/common';
import { StatsService } from './stats.service';
import { NFT } from '../nfts/entities/nft.entity';
import { User } from '../users/entities/user.entity';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('popular-weekly')
  async getPopularThisWeek(): Promise<NFT[]> {
    return this.statsService.getPopularThisWeek();
  }

  @Get('top-sellers')
  async getTopSellers(): Promise<User[]> {
    return this.statsService.getTopSellers();
  }

  @Get('category/:category')
  getNFTsByCategory(@Param('category') category: string): Promise<NFT[]> {
    return this.statsService.getNFTsByCategory(category);
  }
}