import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
//import { NftModule } from './nft/nft.module';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          transport:
            config.get('NODE_ENV') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                  },
                }
              : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          customLogLevel: (req, res) => {
            if (res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
        },
      }),
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: (await import('cache-manager-redis-store')).default,
        host: config.get('REDIS_HOST') || 'localhost',
        port: parseInt(config.get('REDIS_PORT') || '6379', 10),
        password: config.get('REDIS_PASSWORD'),
        db: parseInt(config.get('REDIS_DB') || '0', 10),
        ttl: parseInt(config.get('CACHE_TTL') || '300', 10),
      }),
    }),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 60 seconds = 1 minute
          limit: 100, // 100 requests per minute (as suggested in issue)
        },
      ],
    }),

    AuthModule,

    // ...(process.env.NODE_ENV === 'test'
    //   ? []
    //   : [
    //       TypeOrmModule.forRootAsync({
    //         imports: [ConfigModule], // TypeOrm still needs imports
    //         inject: [ConfigService],
    //         useFactory: (config: ConfigService) => ({
    //           type: 'postgres',
    //           url: config.get<string>('DATABASE_URL'),
    //           autoLoadEntities: true,
    //           synchronize: false,
    //         }),
    //       }),
    //       UsersModule,
    //     ]),
    ...(process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
  ? []
  : [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const url = config.get<string>('DATABASE_URL');
          if (!url) {
            console.warn('DATABASE_URL not set — skipping DB connection');
            return {}; // empty config → TypeOrm won't connect
          }
          return {
            type: 'postgres',
            url,
            autoLoadEntities: true,
            synchronize: false,
          };
        },
      }),
      UsersModule,
    ]),
   // NftModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
