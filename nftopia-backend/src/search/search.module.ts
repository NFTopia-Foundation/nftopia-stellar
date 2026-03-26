import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nft } from '../modules/nft/entities/nft.entity';
import { SearchController } from './search.controller';
import { SEARCH_CLIENT } from './search.constants';
import { SearchSyncListener } from './search.listener';
import { SearchService } from './search.service';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Nft, User])],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchSyncListener,
    {
      provide: SEARCH_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        SearchService.createClient(configService),
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}
