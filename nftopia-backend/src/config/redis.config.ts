import * as dotenv from 'dotenv';
dotenv.config();

import Redis, { RedisOptions } from 'ioredis';


export const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

console.log(redisOptions)

export const redisClient = new Redis(redisOptions);