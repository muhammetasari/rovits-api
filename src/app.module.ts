import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GooglePlacesService } from './services/google-places.service';
import { PlaceFinderController } from './controllers/place-finder.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    controllers: [PlaceFinderController],
    providers: [
        GooglePlacesService,
        ApiKeyGuard,
    ],
})
export class AppModule {}