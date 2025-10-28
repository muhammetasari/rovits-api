import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GooglePlacesService } from './services/google-places.service';
import { PlaceFinderController } from './controllers/place-finder.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
    ],
    controllers: [PlaceFinderController],
    providers: [GooglePlacesService],
})
export class AppModule {}