import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DataSyncService } from './data-sync.service';
import { GooglePlacesService } from './google-places.service';
import { Place, PlaceDocument } from '../schemas/place.schema';
import { Logger } from '@nestjs/common';

// Global test timeout güvenliği
jest.setTimeout(120_000);

// Mock dependencies
const mockGooglePlacesService = {
    discoverPlacesNearby: jest.fn(),
    discoverPlacesByText: jest.fn(),
    getPlaceDetails: jest.fn(),
};

const mockPlaceModel = {
    bulkWrite: jest.fn(),
    countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
    }),
};

const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

describe('DataSyncService', () => {
    let service: DataSyncService;
    let googlePlacesService: GooglePlacesService;
    let placeModel: Model<PlaceDocument>;

    beforeEach(async () => {
        mockGooglePlacesService.discoverPlacesNearby.mockClear();
        mockGooglePlacesService.discoverPlacesByText.mockClear();
        mockGooglePlacesService.getPlaceDetails.mockClear();
        mockPlaceModel.bulkWrite.mockClear();

        mockPlaceModel.countDocuments.mockClear();
        mockPlaceModel.countDocuments().exec.mockClear().mockResolvedValue(0);

        mockLogger.log.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DataSyncService,
                { provide: GooglePlacesService, useValue: mockGooglePlacesService },
                { provide: getModelToken(Place.name), useValue: mockPlaceModel },
                { provide: Logger, useValue: mockLogger },
            ],
        }).compile();

        service = module.get<DataSyncService>(DataSyncService);
        googlePlacesService = module.get<GooglePlacesService>(GooglePlacesService);
        placeModel = module.get<Model<PlaceDocument>>(getModelToken(Place.name));
        (service as any).logger = mockLogger;

        // TEST İÇİN GECİKMEYİ SIFIRLA — kritik
        (service as any).DELAY_BETWEEN_REGIONS_MS = 0;
        (service as any).DELAY_BETWEEN_PAGES_MS = 0;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('hybridSyncPlacesData', () => {
        const mockNearbyResultPage1 = {
            places: [
                { id: 'nearby1', types: ['tourist_attraction'] },
                { id: 'nearby2', types: ['museum'] },
            ],
            nextPageToken: undefined,
        };
        const mockTextResultPage1 = {
            places: [
                { id: 'text1', types: ['historical_landmark'] },
                { id: 'nearby1', types: ['tourist_attraction', 'point_of_interest'] },
                { id: 'text2', types: ['restaurant'] },
            ],
            nextPageToken: 'token_page2',
        };
        const mockTextResultPage2 = {
            places: [{ id: 'text3', types: ['museum'] }],
            nextPageToken: undefined,
        };
        const mockDetailsNearby1 = {
            id: 'nearby1',
            displayName: { text: 'Nearby Place 1' },
            types: ['tourist_attraction', 'point_of_interest'],
        };
        const mockDetailsNearby2 = {
            id: 'nearby2',
            displayName: { text: 'Nearby Museum' },
            types: ['museum'],
        };
        const mockDetailsText1 = {
            id: 'text1',
            displayName: { text: 'Historic Site 1' },
            types: ['historical_landmark'],
        };
        const mockDetailsText3 = {
            id: 'text3',
            displayName: { text: 'Another Museum' },
            types: ['museum'],
        };
        const mockBulkWriteResult = { upsertedCount: 4, modifiedCount: 0 };

        it('should run hybrid sync, filter types, enrich, and save correctly', async () => {
            // Arrange
            mockGooglePlacesService.discoverPlacesNearby.mockResolvedValue(mockNearbyResultPage1);
            mockGooglePlacesService.discoverPlacesByText
                .mockResolvedValueOnce(mockTextResultPage1)
                .mockResolvedValueOnce(mockTextResultPage2)
                .mockResolvedValue({ places: [], nextPageToken: undefined });

            mockGooglePlacesService.getPlaceDetails.mockImplementation(async (placeId: string) => {
                if (placeId === 'nearby1') return mockDetailsNearby1;
                if (placeId === 'nearby2') return mockDetailsNearby2;
                if (placeId === 'text1') return mockDetailsText1;
                if (placeId === 'text3') return mockDetailsText3;
                throw new Error(`Unexpected getPlaceDetails call for ${placeId}`);
            });

            mockPlaceModel.bulkWrite.mockResolvedValue(mockBulkWriteResult);

            mockPlaceModel.countDocuments().exec
                .mockResolvedValueOnce(0) // initialDbCount
                .mockResolvedValueOnce(4); // finalDbCount

            // Act
            const result = await service.hybridSyncPlacesData(10);

            // Assert
            expect(mockGooglePlacesService.discoverPlacesNearby).toHaveBeenCalledTimes(20 * 3);
            expect(mockGooglePlacesService.getPlaceDetails).toHaveBeenCalledTimes(4);
            expect(mockGooglePlacesService.getPlaceDetails).not.toHaveBeenCalledWith('text2');
            expect(mockPlaceModel.bulkWrite).toHaveBeenCalledTimes(1);
            expect(result.filtered).toBe(4);
            expect(result.enriched).toBe(4);
            expect(result.saved).toBe(4);
            expect(result.errors).toBe(0);
            expect(result.totalUniqueRaw).toBe(5);
            expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Initial place count in DB: 0'));
            expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Finished HYBRID sync process. Final DB count: 4'));
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should count enrichment errors and proceed with successful ones', async () => {
            // Arrange discovery to produce 3 filtered IDs: nearby1, nearby2, text1
            mockGooglePlacesService.discoverPlacesNearby.mockResolvedValue({ places: [
                { id: 'nearby1', types: ['tourist_attraction'] },
                { id: 'nearby2', types: ['museum'] },
            ] });
            mockGooglePlacesService.discoverPlacesByText
                .mockResolvedValue({ places: [{ id: 'text1', types: ['historical_landmark'] }], nextPageToken: undefined });

            mockGooglePlacesService.getPlaceDetails.mockImplementation(async (placeId: string) => {
                if (placeId === 'nearby1') return { id: 'nearby1' };
                if (placeId === 'nearby2') throw new Error('details failed');
                if (placeId === 'text1') return { id: 'text1' };
            });

            mockPlaceModel.bulkWrite.mockResolvedValue({ upsertedCount: 2, modifiedCount: 0 });

            const res = await service.hybridSyncPlacesData(10);

            expect(res.filtered).toBe(3);
            expect(res.enriched).toBe(2); // nearby2 failed
            expect(res.saved).toBe(2);
            expect(res.errors).toBeGreaterThanOrEqual(1);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get details for placeId nearby2'));
        });

        it('should increment errors and return saved=0 when DB bulkWrite fails', async () => {
            mockGooglePlacesService.discoverPlacesNearby.mockResolvedValue({ places: [
                { id: 'n1', types: ['museum'] },
            ] });
            mockGooglePlacesService.discoverPlacesByText.mockResolvedValue({ places: [], nextPageToken: undefined });
            mockGooglePlacesService.getPlaceDetails.mockResolvedValue({ id: 'n1' });

            mockPlaceModel.bulkWrite.mockRejectedValue(new Error('db down'));

            const res = await service.hybridSyncPlacesData(10);

            expect(res.filtered).toBe(1);
            expect(res.enriched).toBe(1);
            expect(res.saved).toBe(0);
            expect(res.errors).toBeGreaterThanOrEqual(1);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during database bulk write:'), expect.any(String));
        });
    });
});
