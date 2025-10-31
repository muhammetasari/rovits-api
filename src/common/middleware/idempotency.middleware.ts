import { Inject, Injectable, Logger, NestMiddleware, ConflictException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { REDIS_CLIENT } from '../../redis/redis.provider';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
    private readonly logger = new Logger(IdempotencyMiddleware.name);
    private readonly ttl: number;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly configService: ConfigService,
    ) {
        this.ttl = this.configService.get<number>('IDEMPOTENCY_KEY_TTL_SECONDS', 86400); // 24 saat
    }

    async use(req: Request, res: Response, next: NextFunction) {
        if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') {
            return next();
        }

        const idempotencyKey = req.headers['idempotency-key'] as string;
        if (!idempotencyKey) {
            return next();
        }

        const redisKey = `idempotency:${idempotencyKey}`;

        try {
            const data = await this.redis.get(redisKey);

            if (data) {
                this.logger.warn(`Replayed Idempotency-Key detected: ${idempotencyKey}`);
                const parsedData = JSON.parse(data);

                res.setHeader('Idempotency-Replayed', 'true');
                res.status(parsedData.status).json(parsedData.body);
                return;
            }

            const originalJson = res.json.bind(res);
            const originalSend = res.send.bind(res);

            res.send = (body: any): Response => {
                const responseData = {
                    status: res.statusCode,
                    body: body,
                };

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.redis.set(redisKey, JSON.stringify(responseData), 'EX', this.ttl)
                        .catch(err => this.logger.error('Failed to cache idempotency response (send)', err));
                }

                return originalSend(body);
            };

            res.json = (body: any): Response => {
                const responseData = {
                    status: res.statusCode,
                    body: body,
                };

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.redis.set(redisKey, JSON.stringify(responseData), 'EX', this.ttl)
                        .catch(err => this.logger.error('Failed to cache idempotency response (json)', err));
                }

                return originalJson(body);
            };

            next();

        } catch (error) {
            this.logger.error('Idempotency middleware Redis error', error);
            return next(new ConflictException('Idempotency check failed due to store error.'));
        }
    }
}