import { forwardRef, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bid } from './entities/bid.entity';
import { Auction } from '../auctions/entities/auction.entity';
import { User } from '../users/entities/user.entity';
import { BidsService } from './bids.service';
import { BidsController } from './bids.controller';
import { EventsModule } from 'src/events/events.module';

const bidsServiceProvider: Provider = {
  provide: 'BIDS_SERVICE',
  useClass: BidsService
};
@Module({
  imports: [
    TypeOrmModule.forFeature([Bid, Auction, User]),
    forwardRef(() => EventsModule)
  ],
  controllers: [BidsController],
  // providers: [BidsService],
  providers: [bidsServiceProvider, BidsService],
  exports: [bidsServiceProvider, BidsService], // Export both token and class
  })
export class BidsModule {}
