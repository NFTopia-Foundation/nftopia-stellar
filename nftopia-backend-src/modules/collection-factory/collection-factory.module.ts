import { Module } from '@nestjs/common';
import { CollectionFactoryController } from './collection-factory.controller';
import { CollectionFactoryService } from './collection-factory.service';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [StellarModule],
  controllers: [CollectionFactoryController],
  providers: [CollectionFactoryService],
  exports: [CollectionFactoryService],
})
export class CollectionFactoryModule {}
