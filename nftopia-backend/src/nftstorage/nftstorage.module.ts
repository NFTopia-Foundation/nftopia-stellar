import { Module } from '@nestjs/common';
import { NftStorageService } from './nftstorage.service';

@Module({
  providers: [NftStorageService],
  exports: [NftStorageService], 
})
export class NftStorageModule {}
