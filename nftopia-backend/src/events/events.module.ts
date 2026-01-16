// src/events/events.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { Auction } from '../auctions/entities/auction.entity';
import { Bid } from '../bids/entities/bid.entity';
import { JwtModule } from '@nestjs/jwt';
import { AuctionsModule } from 'src/auctions/auctions.module';
import { BidsModule } from 'src/bids/bids.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([Auction, Bid]),
    JwtModule.register({
        secret: process.env.JWT_SECRET || 'my_jwt_secret', // use env var in production
        signOptions: { expiresIn: '7d' },
      }),
    forwardRef(() => BidsModule),
    forwardRef(() => AuctionsModule),
    AuthModule,
  ],
  providers: [EventsGateway, EventsService],
  exports: [EventsGateway, EventsService],
})
export class EventsModule {}

