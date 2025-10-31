import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GooglePlacesService } from './services/google-places.service';
import { PlaceFinderController } from './controllers/place-finder.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { Place, PlaceSchema } from './schemas/place.schema';
import { DataSyncService } from './services/data-sync.service';
import { AdminController } from './controllers/admin.controller';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { JobProcessorModule } from './job-processor/job-processor.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { LoggerModule } from 'nestjs-pino';
import { validationSchema } from './config/validation.schema';
import * as crypto from 'crypto';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { RedisModule } from './redis/redis.module';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: validationSchema,
            ignoreEnvFile: process.env.NODE_ENV === 'production',
        }),
        LoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                pinoHttp: {
                    level: configService.get<string>('LOG_LEVEL', 'info'),
                    transport:
                        configService.get<string>('NODE_ENV') !== 'production'
                            ? {
                                target: 'pino-pretty',
                                options: {
                                    singleLine: true,
                                    colorize: true,
                                    levelFirst: true,
                                    translateTime: 'SYS:HH:MM:ss.l',
                                },
                            }
                            : undefined,
                    autoLogging: true,
                    quietReqLogger: true,
                    genReqId: (req, res) => {
                        const existingId =
                            (req as any).id ?? req.headers['x-correlation-id'];
                        const id = existingId ?? crypto.randomUUID();
                        if (res && res.setHeader) {
                            res.setHeader('X-Correlation-ID', id);
                        }
                        return id;
                    },
                },
            }),
        }),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 60,
            },
        ]),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                connection: {
                    host: configService.get<string>('REDIS_HOST'),
                    port: configService.get<number>('REDIS_PORT'),
                    password: configService.get<string>('REDIS_PASSWORD'),
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({
            name: 'syncQueue',
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                uri: configService.get<string>('DATABASE_URL'),
                autoIndex: true,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([{ name: Place.name, schema: PlaceSchema }]),
        PassportModule,
        AuthModule,
        JobProcessorModule,
        HealthModule,
        MetricsModule,
        RedisModule,
    ],
    controllers: [PlaceFinderController, AdminController],
    providers: [
        GooglePlacesService,
        ApiKeyGuard,
        DataSyncService,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(IdempotencyMiddleware)
            .forRoutes(
                { path: 'api/v1/place-finder/bulk-search', method: RequestMethod.POST },
                { path: 'api/v1/admin/sync-places', method: RequestMethod.POST }
            );
    }
}