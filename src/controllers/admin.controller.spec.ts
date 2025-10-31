import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ConfigService } from '@nestjs/config';

describe('AdminController', () => {
    let controller: AdminController;
    let queueMock: Partial<Queue> & { add: jest.Mock };

    beforeEach(async () => {
        queueMock = {
            add: jest.fn(),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdminController],
            providers: [
                {
                    provide: getQueueToken('syncQueue'),
                    useValue: queueMock,
                },
                {
                    provide: ApiKeyGuard,
                    useValue: { canActivate: () => true },
                },
                {
                    provide: ConfigService,
                    useValue: { get: jest.fn() },
                },
            ],
        }).compile();

        controller = module.get<AdminController>(AdminController);
    });

    it('should queue job with default maxResults=1000 when not provided', async () => {
        queueMock.add.mockResolvedValue({ id: '1' });
        const res = await controller.syncPlacesData(undefined as any);

        expect(queueMock.add).toHaveBeenCalledWith('sync-places-job', { maxResults: 1000 });
        expect(res).toEqual({
            message: 'Sync process has been successfully queued. It will run in the background.',
            jobId: '1',
            optionsUsed: { maxResults: 1000 },
        });
    });

    it('should queue job with provided maxResults', async () => {
        queueMock.add.mockResolvedValue({ id: '99' });
        const res = await controller.syncPlacesData({ maxResults: 250 } as any);

        expect(queueMock.add).toHaveBeenCalledWith('sync-places-job', { maxResults: 250 });
        expect(res.jobId).toBe('99');
        expect(res.optionsUsed.maxResults).toBe(250);
    });

    it('should throw 500 when queue add fails', async () => {
        queueMock.add.mockRejectedValue(new Error('redis down'));
        await expect(controller.syncPlacesData({ maxResults: 50 } as any)).rejects.toThrow('Failed to queue the sync process.');
    });
});


