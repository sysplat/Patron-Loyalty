import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisPubSubManager } from './redis-pubsub-manager.service';

@Global()
@Module({
  providers: [RedisService, RedisPubSubManager],
  exports: [RedisService, RedisPubSubManager],
})
export class RedisModule {}
