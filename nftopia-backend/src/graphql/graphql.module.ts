import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { ListingResolver } from './resolvers/listing.resolver';
import { Request } from 'express';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      context: (ctx: { req: Request }) => ({ req: ctx.req }),
      path: '/graphql',
    }),
    MarketplaceModule,
  ],
  providers: [ListingResolver],
})
export class AppGraphqlModule {}
