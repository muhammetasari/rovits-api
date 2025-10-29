import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GooglePlacesService } from './google-places.service';
import { NotFoundException, BadRequestException, UnauthorizedException, BadGatewayException, InternalServerErrorException } from '@nestjs/common';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GooglePlacesService', () => {
    let service: GooglePlacesService;
    let configService: ConfigService;
    const mockApiKey = 'test-api-key';

    beforeEach(async () => {
        mockFetch.mockClear();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GooglePlacesService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'GOOGLE_PLACES_API_KEY') { return mockApiKey; }
                            return null;
                        }),
                    },
                },
            ],
        }).compile();
        service = module.get<GooglePlacesService>(GooglePlacesService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getPlaceDetails', () => {
        const placeId = 'test-place-id';
        // ... (expectedUrl, expectedHeaders tanımlamaları aynı) ...
        const expectedUrl = `https://places.googleapis.com/v1/places/${placeId}`;
        const expectedHeaders = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': mockApiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,types,regularOpeningHours,currentOpeningHours,photos,websiteUri,nationalPhoneNumber,businessStatus,googleMapsUri,reviews,editorialSummary,priceLevel,accessibilityOptions'
        };


        it('should call fetch with correct URL and headers', async () => { /* ... */ });
        it('should return place details on successful fetch', async () => { /* ... */ });
        it('should throw NotFoundException on 404 response', async () => { /* ... */ });
        it('should throw BadRequestException on 400 INVALID_ARGUMENT response', async () => { /* ... */ });
        it('should throw UnauthorizedException on 401 response', async () => { /* ... */ });
        it('should throw UnauthorizedException on 403 response', async () => { /* ... */ });
        it('should throw BadGatewayException on other non-ok responses (e.g., 500)', async () => { /* ... */ });


        it('should throw InternalServerErrorException with correct message if fetch itself fails', async () => {
            const fetchError = new Error('Network error');
            mockFetch.mockRejectedValueOnce(fetchError);

            // Tek bir expect ile hem tipi hem mesajı kontrol et
            await expect(service.getPlaceDetails(placeId)).rejects.toThrow(
                new InternalServerErrorException('Network error')
            );
        });

    });

    describe('searchPlace', () => {
        const query = 'test query';
        const expectedUrl = 'https://places.googleapis.com/v1/places:searchText';
        const expectedHeaders = { /*...*/ };
        const expectedBody = JSON.stringify({ textQuery: query });

        it('should call fetch with correct URL, headers, and body', async () => { /*...*/ });
        it('should return search results on successful fetch', async () => { /*...*/ });
        it('should throw UnauthorizedException on 400/401/403 response', async () => { /*...*/ });
        it('should throw BadGatewayException on other non-ok responses', async () => { /*...*/ });
        it('should throw InternalServerErrorException if fetch itself fails', async () => { /*...*/ });
    });

    describe('discoverPlacesNearby', () => {
        const lat = 41.0, lon = 29.0, rad = 5000;
        const types = ['museum'];
        const expectedUrl = 'https://places.googleapis.com/v1/places:searchNearby';
        const expectedHeaders = { /*...*/ };
        const expectedBodyBase = { /*...*/ };


        it('should call fetch correctly without page token', async () => { /*...*/ }); // Bu başarısızdı
        it('should call fetch correctly with page token', async () => { /*...*/ }); // Bu başarısızdı
        it('should return places and nextPageToken on success', async () => { /*...*/ });
        it('should return empty places if page token is invalid (400 INVALID_ARGUMENT)', async () => { /*...*/ });
        it('should throw BadRequestException for other 400 INVALID_ARGUMENT errors', async () => { /*...*/ });
    });

    describe('discoverPlacesByText', () => {
    });

});