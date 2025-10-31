// src/job-processor/sync.processor.ts

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSyncService } from '../services/data-sync.service';

interface SyncPlacesJobData {
    maxResults: number;
}

@Injectable()
@Processor('syncQueue') //
export class SyncProcessor extends WorkerHost {
    private readonly logger = new Logger(SyncProcessor.name);

    constructor(private readonly dataSyncService: DataSyncService) {
        super();
    }

    async process(job: Job<SyncPlacesJobData, any, string>): Promise<any> {
        this.logger.log(`Processing job ID: ${job.id}, Name: ${job.name}`);

        switch (job.name) {
            case 'sync-places-job':
                try {
                    this.logger.log(`Starting hybridSyncPlacesData for job ID: ${job.id}`);
                    const result = await this.dataSyncService.hybridSyncPlacesData(job.data.maxResults);
                    return result;
                } catch (error) {
                    this.logger.error(`Job ID: ${job.id} ('${job.name}') failed:`, error.stack || error.message);
                    throw error;
                }

            default:
                this.logger.warn(`Unhandled job name: ${job.name} (ID: ${job.id})`);
                throw new Error(`Unhandled job name: ${job.name}`);
        }
    }


    @OnWorkerEvent('completed')
    onCompleted(job: Job, result: any): void {
        this.logger.log(`Job completed: ID ${job.id}, Name ${job.name}.`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job | undefined, err: Error): void {
        if (job) {
            this.logger.error(`Job failed: ID ${job.id}, Name ${job.name}. Error: ${err.message}`, err.stack);
        } else {
            this.logger.error(`A job failed (details unavailable). Error: ${err.message}`, err.stack);
        }
    }

    @OnWorkerEvent('error')
    onError(err: Error): void {
        this.logger.error(`Worker error: ${err.message}`, err.stack);
    }

    @OnWorkerEvent('active')
    onActive(job: Job): void {
        this.logger.log(`Job active: ID ${job.id}, Name ${job.name}`);
    }
}