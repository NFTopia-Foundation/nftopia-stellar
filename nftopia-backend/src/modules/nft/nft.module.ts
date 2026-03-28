import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NftController } from './nft.controller';
import { NftService } from './nft.service';
import { Nft } from './entities/nft.entity';
import { NftMetadata } from './entities/nft-metadata.entity';
import { User } from '../../users/user.entity';
import { SorobanService } from '../../nft/soroban.service';

@Module({
  imports: [
    EventEmitterModule,
    TypeOrmModule.forFeature([Nft, NftMetadata, User]),
  ],
  controllers: [NftController],
  providers: [NftService, SorobanService],
  exports: [NftService],
})
export class NftModule {}
