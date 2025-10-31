import { SyncProcessor } from './sync.processor';
import { DataSyncService } from '../services/data-sync.service';

describe('SyncProcessor', () => {
    let processor: SyncProcessor;
    let dataSyncService: { hybridSyncPlacesData: jest.Mock };

    beforeEach(() => {
        dataSyncService = {
            hybridSyncPlacesData: jest.fn(),
        } as any;
        processor = new SyncProcessor(dataSyncService as unknown as DataSyncService);
    });

    function createJob(name: string, maxResults = 1000) {
        return {
            id: 'job-1',
            name,
            data: { maxResults },
        } as any;
    }

    it("should call dataSyncService.hybridSyncPlacesData for 'sync-places-job'", async () => {
        dataSyncService.hybridSyncPlacesData.mockResolvedValue({ saved: 10 });
        const job = createJob('sync-places-job', 250);

        const result = await processor.process(job);

        expect(dataSyncService.hybridSyncPlacesData).toHaveBeenCalledWith(250);
        expect(result).toEqual({ saved: 10 });
    });

    it('should rethrow errors from dataSyncService', async () => {
        dataSyncService.hybridSyncPlacesData.mockRejectedValue(new Error('boom'));
        const job = createJob('sync-places-job', 100);

        await expect(processor.process(job)).rejects.toThrow('boom');
    });

    it('should throw on unhandled job name', async () => {
        const job = createJob('unknown-job', 100);
        await expect(processor.process(job)).rejects.toThrow('Unhandled job name: unknown-job');
    });
});


