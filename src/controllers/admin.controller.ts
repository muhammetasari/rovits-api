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
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty, ApiSecurity } from '@nestjs/swagger';

class SyncOptionsDto {
    @ApiProperty({
        description: 'Target maximum number of results for the sync job.',
        minimum: 10,
        maximum: 1000,
        default: 1000,
        required: false,
    })
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(1000)
    maxResults?: number = 1000;
}

interface SyncPlacesJobData {
    maxResults: number;
}


@ApiTags('Admin')
@ApiSecurity('ApiKeyAuth')
@Controller('admin')
@UseGuards(ApiKeyGuard)
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(
        @InjectQueue('syncQueue') private readonly syncQueue: Queue<SyncPlacesJobData>,
    ) {}

    @Post('sync-places')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: 'Trigger Background Sync Job',
        description: 'Queues a background job (BullMQ) to perform a hybrid data sync from Google Places API to the local database.'
    })
    @ApiBody({ type: SyncOptionsDto, required: false })
    @ApiResponse({
        status: HttpStatus.ACCEPTED,
        description: 'The sync job has been successfully queued.',
        schema: {
            example: {
                message: 'Sync process has been successfully queued. It will run in the background.',
                jobId: '123',
                optionsUsed: { maxResults: 1000 }
            }
        }
    })
    @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or missing API Key.' })
    @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to queue the job.' })
    async syncPlacesData(@Body(new ValidationPipe({ transform: true, whitelist: true })) options?: SyncOptionsDto) {
        this.logger.log(`Received request to queue HYBRID sync-places job with options: ${JSON.stringify(options)}`);

        const maxResults = options?.maxResults ?? 1000;

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
            throw new InternalServerErrorException('Failed to queue the sync process.');
        }
    }
}