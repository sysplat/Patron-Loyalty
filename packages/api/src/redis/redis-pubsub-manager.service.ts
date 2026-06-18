import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

@Injectable()
export class RedisPubSubManager implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubManager.name);
  private subscriberClient: Redis | null = null;

  // Maps channel string -> Set of client callbacks
  private readonly listeners = new Map<string, Set<(data: string) => void>>();
  private readonly isSubscribingMap = new Map<string, boolean>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * Subscribe to a Redis Pub/Sub channel using a single shared client connection.
   */
  async subscribe(channel: string, callback: (data: string) => void): Promise<() => void> {
    this.ensureSubscriberConnected();

    let channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      channelListeners = new Set();
      this.listeners.set(channel, channelListeners);
    }

    channelListeners.add(callback);

    // If this is the first listener for this channel, send a SUBSCRIBE command to Redis
    if (channelListeners.size === 1) {
      try {
        this.isSubscribingMap.set(channel, true);
        await this.subscriberClient!.subscribe(channel);
        this.isSubscribingMap.delete(channel);
        this.logger.log(`Subscribed to Redis channel: ${channel} (Shared Connection)`);
      } catch (err) {
        this.listeners.delete(channel);
        this.isSubscribingMap.delete(channel);
        this.logger.error(`Failed to subscribe to channel ${channel}:`, err);
        throw err;
      }
    }

    // Return a clean teardown function
    return () => {
      this.unsubscribe(channel, callback);
    };
  }

  private unsubscribe(channel: string, callback: (data: string) => void) {
    const channelListeners = this.listeners.get(channel);
    if (!channelListeners) return;

    channelListeners.delete(callback);

    // If no more clients are listening to this channel, let Redis know
    if (channelListeners.size === 0) {
      this.listeners.delete(channel);

      // Fire-and-forget unsubscribe from Redis server to save resources
      this.subscriberClient!.unsubscribe(channel)
        .then(() => this.logger.log(`Unsubscribed from Redis channel: ${channel}`))
        .catch((err) => this.logger.error(`Error unsubscribing from channel ${channel}:`, err));
    }
  }

  private ensureSubscriberConnected() {
    if (this.subscriberClient) return;

    this.logger.log('Initializing shared Redis subscriber client...');
    this.subscriberClient = this.redisService.duplicateForSubscribe();

    this.subscriberClient.on('message', (channel, message) => {
      const callbacks = this.listeners.get(channel);
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(message);
          } catch (err) {
            this.logger.error(`Error executing SSE callback for channel ${channel}:`, err);
          }
        }
      }
    });

    this.subscriberClient.on('error', (err) => {
      this.logger.error('Shared Redis subscriber connection error:', err);
    });
  }

  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
    }
  }
}
