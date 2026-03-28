import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/user.entity';
import { Nft } from '../nft/entities/nft.entity';
import { CollectionService } from './collection.service';
import { Collection } from './entities/collection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Collection, Nft, User])],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
