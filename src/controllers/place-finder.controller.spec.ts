import { Test, TestingModule } from '@nestjs/testing';
import { PlaceFinderController } from './place-finder.controller';
import { GooglePlacesService } from '../services/google-places.service';
import { BadRequestException } from '@nestjs/common';

describe('PlaceFinderController', () => {
    let controller: PlaceFinderController;
    let googleMock: {
        searchPlace: jest.Mock;
        getPlaceDetails: jest.Mock;
    };

    beforeEach(async () => {
        googleMock = {
            searchPlace: jest.fn(),
            getPlaceDetails: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PlaceFinderController],
            providers: [
                { provide: GooglePlacesService, useValue: googleMock },
            ],
        }).compile();

        controller = module.get<PlaceFinderController>(PlaceFinderController);
    });

    describe('search', () => {
        it('should throw 400 when q is missing', async () => {
            await expect(controller.search('' as any)).rejects.toThrow(BadRequestException);
        });

        it('should return simplified top result', async () => {
            googleMock.searchPlace.mockResolvedValue({
                places: [{ id: 'p1', displayName: { text: 'X' }, formattedAddress: 'Addr' }],
            });
            const res = await controller.search('Galata');
            expect(res).toEqual({ query: 'Galata', placeId: 'p1', name: 'X', address: 'Addr' });
        });
    });

    describe('bulkSearch', () => {
        it('should map each query to simplified result, with error on failures', async () => {
            googleMock.searchPlace
                .mockResolvedValueOnce({ places: [{ id: 'a', displayName: { text: 'A' }, formattedAddress: 'AA' }] })
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce({ places: [{ id: 'c', displayName: { text: 'C' }, formattedAddress: 'CC' }] });

            const res = await controller.bulkSearch({ queries: ['q1', 'q2', 'q3'] } as any);

            expect(res).toEqual([
                { query: 'q1', placeId: 'a', name: 'A', address: 'AA' },
                { query: 'q2', error: 'Not found or request failed' },
                { query: 'q3', placeId: 'c', name: 'C', address: 'CC' },
            ]);
        });
    });

    describe('getDetails', () => {
        it('should call getPlaceDetails directly when placeId provided', async () => {
            googleMock.getPlaceDetails.mockResolvedValue({ id: 'x' });
            const res = await controller.getDetails('abc', undefined);
            expect(googleMock.getPlaceDetails).toHaveBeenCalledWith('abc');
            expect(res).toEqual({ id: 'x' });
        });

        it('should search by name then fetch details when placeId missing', async () => {
            googleMock.searchPlace.mockResolvedValue({ places: [{ id: 'found' }] });
            googleMock.getPlaceDetails.mockResolvedValue({ id: 'found', more: true });

            const res = await controller.getDetails(undefined, 'Tower');

            expect(googleMock.searchPlace).toHaveBeenCalledWith('Tower');
            expect(googleMock.getPlaceDetails).toHaveBeenCalledWith('found');
            expect(res).toMatchObject({ id: 'found', _searchInfo: { searchedName: 'Tower', foundPlaceId: 'found' } });
        });

        it('should 400 when neither placeId nor name provided', async () => {
            await expect(controller.getDetails(undefined, undefined)).rejects.toThrow(BadRequestException);
        });

        it('should 400 when name provided but not found', async () => {
            googleMock.searchPlace.mockResolvedValue({ places: [] });
            await expect(controller.getDetails(undefined, 'Nope')).rejects.toThrow(BadRequestException);
        });
    });
});


