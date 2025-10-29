import { Module } from '@nestjs/common';
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

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 60,
        }]),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                connection: {
                    host: configService.get<string>('REDIS_HOST', 'localhost'),
                    port: configService.get<number>('REDIS_PORT', 6379),
                    // password: configService.get<string>('REDIS_PASSWORD'),
                },
            }),
            inject: [ConfigService],
        }),
        // --- Kuyruğu AppModule'de Tekrar Kaydet ---
        BullModule.registerQueue({
            name: 'syncQueue',
        }),
        // --- Mongoose Yapılandırması ---
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

        // --- JobProcessorModule'ü imports dizisine ekleyin ---
        JobProcessorModule,
    ],
    controllers: [
        PlaceFinderController,
        AdminController,
    ],
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
export class AppModule {}