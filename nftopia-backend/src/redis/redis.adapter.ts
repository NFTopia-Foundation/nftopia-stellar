import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { ServerOptions } from 'socket.io';
import { Logger } from '@nestjs/common';

interface RedisAdapterWithClients {
  adapter: ReturnType<typeof createAdapter>;
  pubClient: RedisClientType;
  subClient: RedisClientType;
}

export class RedisIoAdapter extends IoAdapter {
  private redisAdapter: RedisAdapterWithClients | null = null;
  private readonly logger = new Logger(RedisIoAdapter.name);
  private isConnected = false;

  async connectToRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.logger.log(`Connecting to Redis at ${redisUrl}`);

      const pubClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              this.logger.error('Max Redis reconnection attempts reached');
              return new Error('Max retries reached');
            }
            return Math.min(retries * 100, 5000);
          },
        },
      }) as RedisClientType;

      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        this.logger.error('Redis PubClient Error:', err);
        this.isConnected = false;
      });

      subClient.on('error', (err) => {
        this.logger.error('Redis SubClient Error:', err);
        this.isConnected = false;
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Correctly initialize the adapter by calling the function
      const adapterFn = createAdapter(pubClient, subClient);
      this.redisAdapter = {
        adapter: adapterFn, // Store the adapter function
        pubClient,
        subClient
      };

      this.isConnected = true;
      this.logger.log('Redis adapter successfully initialized');

    } catch (error) {
      this.logger.error('Redis connection failed:', error.message);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    
    if (!this.isConnected || !this.redisAdapter) {
      this.logger.warn('Using default in-memory adapter (Redis not connected)');
      return server;
    }

    // Apply the adapter to the server
    server.adapter(this.redisAdapter.adapter);
    return server;
  }

  async onApplicationShutdown() {
    if (this.redisAdapter) {
      try {
        await Promise.all([
          this.redisAdapter.pubClient.quit(),
          this.redisAdapter.subClient.quit(),
        ]);
        this.logger.log('Redis connections closed');
      } catch (err) {
        this.logger.error('Redis shutdown error:', err);
      } finally {
        this.redisAdapter = null;
      }
    }
  }

  public getStatus() {
    return {
      isConnected: this.isConnected,
      adapterType: this.redisAdapter ? 'redis' : 'memory'
    };
  }
}

