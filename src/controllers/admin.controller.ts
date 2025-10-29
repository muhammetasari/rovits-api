import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { DataSyncService } from '../services/data-sync.service';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// DTO for sync options (received in request body)
class SyncOptionsDto {
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(1000) // Allow requesting up to 1000
    maxResults?: number = 1000; // Default target is 1000
}

@Controller('admin')
@UseGuards(ApiKeyGuard) // Secure all routes in this controller
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(private readonly dataSyncService: DataSyncService) {}

    // Endpoint to trigger the hybrid data sync process
    @Post('sync-places')
    @HttpCode(HttpStatus.ACCEPTED) // Return 202 Accepted as the process runs in the background
    async syncPlacesData(@Body(new ValidationPipe({ transform: true, whitelist: true })) options?: SyncOptionsDto) {
        this.logger.log(`Manual trigger received for HYBRID sync-places with options: ${JSON.stringify(options)}`);

        // Get target count from options or use the default
        const maxResults = options?.maxResults ?? 1000;

        // Start the sync process asynchronously (don't await here)
        this.dataSyncService.hybridSyncPlacesData(maxResults)
            .then(result => this.logger.log(`Hybrid sync places process completed: ${JSON.stringify(result)}`))
            .catch(error => this.logger.error(`Hybrid sync places process failed:`, error.stack || error.message));

        // Immediately respond to the client
        return {
            message: 'HYBRID Sync process (Nearby Search + Text Search) started. Process runs in background. Check server logs for details.',
            optionsUsed: { maxResults }
        };
    }
}