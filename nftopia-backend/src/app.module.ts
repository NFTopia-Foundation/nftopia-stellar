import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { CollectionsModule } from './collections/collections.module';
import { NftsModule } from './nfts/nfts.module';
import { User } from './users/entities/user.entity';
import { Collection } from './collections/entities/collection.entity';
import { NFT } from './nfts/entities/nft.entity';
import { AuthModule } from './auth/auth.module';
import { BidsModule } from './bids/bids.module';
import { AuctionsModule } from './auctions/auctions.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { StatsModule } from './stats/stats.module';
import { StarknetModule } from './starknet/starknet.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER || 'nftopia',
      password: process.env.POSTGRES_PASSWORD || 'nftopia123',
      database: process.env.POSTGRES_DB || 'nftopiadb',
      schema: 'nftopia_user_service',
      entities: [User, Collection, NFT],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: true,
      autoLoadEntities: true,
      synchronize: true,
      logging: true,
    }),
    UsersModule,
    CollectionsModule,
    NftsModule,
    AuthModule,
    BidsModule,
    AuctionsModule,
    TransactionsModule,
    CategoriesModule,
    StatsModule,
    StarknetModule,
    RedisModule,
    EventsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})

// Use this @Module for Production PostgreSQL

// @Module({
//   imports: [
//     ConfigModule.forRoot({
//       isGlobal: true,
//       envFilePath: '.env'
//     }),
//     TypeOrmModule.forRoot({
//       type: 'postgres',
//       url: process.env.DATABASE_URL,
//       autoLoadEntities: true,
//       synchronize: false,
//     }),
// UsersModule,
// CollectionsModule,
// NftsModule,
// AuthModule,
// BidsModule,
// AuctionsModule,
// TransactionsModule,
// CategoriesModule,
// StatsModule
//   ],
//   controllers: [AppController],
//   providers: [AppService],
// })
export class AppModule {}
