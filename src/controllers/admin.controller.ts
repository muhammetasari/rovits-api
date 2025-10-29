import { Controller, Post, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { DataSyncService } from '../services/data-sync.service';
import { ExplorePlacesDto } from '../dto/explore-places.dto';

@Controller('admin') // Endpoint'ler /admin/... altında olacak
@UseGuards(ApiKeyGuard) // Bu controller'daki tüm endpoint'ler ApiKeyGuard gerektirir
export class AdminController {
    constructor(private readonly dataSyncService: DataSyncService) {}

    @Post('generate-list') // POST /admin/generate-list?latitude=41.01&longitude=28.97&radius=20000&maxResults=100
    @HttpCode(HttpStatus.ACCEPTED) // Uzun sürebileceği için 202 Accepted döndür
    async generateMustSeeList(@Query() query: ExplorePlacesDto) {
        // İsteği hemen kabul et, işlemi arka planda başlat (asenkron)
        // Gerçek bir production ortamında bu bir kuyruğa (queue) atılabilir,
        // ancak şimdilik direkt servisi çağırıyoruz.
        this.dataSyncService.updateMustSeePlaces(
            query.latitude,
            query.longitude,
            query.radius,
            query.maxResults,
        )
            .then(result => console.log('Data sync completed:', result))
            .catch(error => console.error('Data sync failed:', error));

        // Kullanıcıya işlemin başladığını bildir
        return {
            message: `Place data generation started for lat=${query.latitude}, lon=${query.longitude}. Process runs in background.`,
            parameters: query,
        };
    }
}