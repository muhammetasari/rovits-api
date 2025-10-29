import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncProcessor } from './sync.processor';
import { DataSyncService } from '../services/data-sync.service';
import { GooglePlacesService } from '../services/google-places.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Place, PlaceSchema } from '../schemas/place.schema';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'syncQueue',
        }),
        MongooseModule.forFeature([{ name: Place.name, schema: PlaceSchema }]),
    ],
    providers: [
        SyncProcessor,
        DataSyncService,
        GooglePlacesService,
    ],
})
export class JobProcessorModule {}