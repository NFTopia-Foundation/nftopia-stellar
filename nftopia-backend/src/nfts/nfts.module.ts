import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NFT } from './entities/nft.entity';
import { Collection } from '../collections/entities/collection.entity';
import { NftsService } from './nfts.service';
import { NftsController } from './nfts.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { NftStorageService } from '../nftstorage/nftstorage.service';
import { UsersModule } from '../users/users.module';
import { CollectionsModule } from '../collections/collections.module';
import { NftStorageModule } from '../nftstorage/nftstorage.module';
import { Category } from 'src/categories/entities/category.entity';
import { CategoriesModule } from 'src/categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NFT, Collection, Category]),
    UsersModule, 
    FirebaseModule,
    CollectionsModule,
    NftStorageModule,
    CategoriesModule
  ],
  controllers: [NftsController],
  providers: [NftsService, NftStorageService],
})
export class NftsModule {}
