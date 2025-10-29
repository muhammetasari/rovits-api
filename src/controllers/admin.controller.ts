import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    Logger,
    ValidationPipe,
    InternalServerErrorException,
} from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// DTO for sync options (received in request body)
class SyncOptionsDto {
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(1000)
    maxResults?: number = 1000;
}

// --- İş (Job) Verisi İçin Interface (Opsiyonel ama önerilir) ---
interface SyncPlacesJobData {
    maxResults: number;
}


@Controller('admin')
@UseGuards(ApiKeyGuard)
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(
        @InjectQueue('syncQueue') private readonly syncQueue: Queue<SyncPlacesJobData>,
    ) {}

    @Post('sync-places')
    @HttpCode(HttpStatus.ACCEPTED)
    async syncPlacesData(@Body(new ValidationPipe({ transform: true, whitelist: true })) options?: SyncOptionsDto) {
        this.logger.log(`Received request to queue HYBRID sync-places job with options: ${JSON.stringify(options)}`);

        const maxResults = options?.maxResults ?? 1000;

        // --- İşi Kuyruğa Ekleme ---
        try {
            const job = await this.syncQueue.add('sync-places-job', { maxResults });

            this.logger.log(`Job added to syncQueue with ID: ${job.id}`);

            return {
                message: 'Sync process has been successfully queued. It will run in the background.',
                jobId: job.id,
                optionsUsed: { maxResults }
            };
        } catch (error) {
            this.logger.error(`Failed to add job to syncQueue:`, error.stack || error.message);
            // Artık import edildiği için bu satır hata vermeyecek
            throw new InternalServerErrorException('Failed to queue the sync process.');
        }
    }
}