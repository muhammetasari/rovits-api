import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GooglePlacesService } from './services/google-places.service';
import { PlaceFinderController } from './controllers/place-finder.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { Place, PlaceSchema } from './schemas/place.schema';
import { DataSyncService } from './services/data-sync.service';
import { AdminController } from './controllers/admin.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
    ],
    controllers: [
        PlaceFinderController,
        AdminController,
    ],
    providers: [
        GooglePlacesService,
        ApiKeyGuard,
        DataSyncService,
    ],
})
export class AppModule {}