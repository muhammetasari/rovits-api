import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisProvider: FactoryProvider<Redis> = {
    provide: REDIS_CLIENT,
    useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisProvider');
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT');

        const client = new Redis({
            host: redisHost,
            port: redisPort,
            password: configService.get<string>('REDIS_PASSWORD'),
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        });

        client.on('connect', () => logger.log('Idempotency Redis client connected.'));
        client.on('error', (err) => logger.error('Redis client error', err));

        return client;
    },
    inject: [ConfigService],
};