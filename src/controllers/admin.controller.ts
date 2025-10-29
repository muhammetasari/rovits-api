import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { DataSyncService } from '../services/data-sync.service';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Sync işlemi için DTO (Body parametresi olarak)
class SyncOptionsDto {
    @IsOptional()
    @IsInt()
    @Min(10)
    // --- GÜNCELLEME: Üst limit 1000 oldu ---
    @Max(1000)
        // --- GÜNCELLEME: Varsayılan değer 1000 oldu ---
    maxResults?: number = 1000; // Varsayılan hedef sayı
}

@Controller('admin')
@UseGuards(ApiKeyGuard)
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(private readonly dataSyncService: DataSyncService) {}

    @Post('sync-places')
    @HttpCode(HttpStatus.ACCEPTED)
    async syncPlacesData(@Body(new ValidationPipe({ transform: true, whitelist: true })) options?: SyncOptionsDto) {
        this.logger.log(`Manual trigger received for HYBRID sync-places with options: ${JSON.stringify(options)}`);

        // --- GÜNCELLEME: Varsayılan 1000 oldu ---
        const maxResults = options?.maxResults ?? 1000;
        // Location bias kısmı kaldırıldı, çünkü tüm İstanbul'u tarıyoruz
        // Gerekirse DTO'ya geri eklenebilir.

        // Arka planda çalıştır
        this.dataSyncService.hybridSyncPlacesData(maxResults) // Sadece maxResults gönderiliyor
            .then(result => this.logger.log(`Hybrid sync places process completed: ${JSON.stringify(result)}`))
            .catch(error => this.logger.error(`Hybrid sync places process failed:`, error.stack || error.message));

        return {
            message: 'HYBRID Sync process (Nearby Search + Text Search) started. Process runs in background. Check server logs for details.',
            optionsUsed: { maxResults }
        };
    }
}