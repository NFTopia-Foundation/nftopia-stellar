import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { Collection } from './entities/collection.entity'; 
import { User } from '../users/entities/user.entity'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Collection, User]), 
  ],
  providers: [CollectionsService],
  controllers: [CollectionsController],
  exports: [CollectionsService], 
})
export class CollectionsModule {}
