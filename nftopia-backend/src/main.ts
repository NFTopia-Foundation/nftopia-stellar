import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import {
  ResponseInterceptor,
  LoggingInterceptor,
  ErrorInterceptor,
  TimeoutInterceptor,
  TransformInterceptor,
} from './interceptors';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './redis/redis.adapter';
import { paymentQueue } from './queues/payment.queue';
import { notificationsQueue } from './queues/notifications.queue';
import { onchainQueue } from './queues/onchain.queue';
import './queues/onchain.worker';
import metricsHandler from './metrics/queue_metrics';


async function bootstrap() {  
  
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const redisAdapter = new RedisIoAdapter(app);


  app.use(cookieParser());

  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    }),
  );

  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new LoggingInterceptor(),
    new ErrorInterceptor(),
    new TimeoutInterceptor(),
    new TransformInterceptor(),
  );

  try {
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
    console.log('Redis adapter status:', redisAdapter.getStatus());
  } catch (error) {
    console.error('Redis adapter failed:', error.message);
    console.log('Falling back to in-memory adapter');
  }

  app.enableCors({
    origin: ['http://localhost:5000'], // or use your deployed frontend URL
    credentials: true, // Needed if you're using cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  try {
    await Promise.all([
      paymentQueue.waitUntilReady(),
      notificationsQueue.waitUntilReady(),
      onchainQueue.waitUntilReady(),
    ]);
    console.log('All queues are live');

    // Add a sample metrics logger for pending/failed jobs
    setInterval(async () => {
      const jobCounts = await Promise.all([
        paymentQueue.getJobCounts(),
        notificationsQueue.getJobCounts(),
        onchainQueue.getJobCounts(),
      ]);

      console.log('Queue Metrics:', {
        payment: jobCounts[0],
        notifications: jobCounts[1],
        onchain: jobCounts[2],
      });
    }, 60000); // log every 60 seconds

    // Continue bootstrapping app...
  } catch (err) {
    console.error('Queue initialization failed', err);
    process.exit(1);
  }

  await app.listen(process.env.PORT ?? 9000);
}

bootstrap();
