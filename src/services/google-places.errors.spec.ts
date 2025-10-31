import { Test, TestingModule } from '@nestjs/testing';
import { GooglePlacesService } from './google-places.service';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, UnauthorizedException, BadRequestException } from '@nestjs/common';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GooglePlacesService error scenarios', () => {
    let service: GooglePlacesService;
    const mockApiKey = 'test-api-key';

    beforeEach(async () => {
        mockFetch.mockReset();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GooglePlacesService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) => (key === 'GOOGLE_PLACES_API_KEY' ? mockApiKey : undefined),
                    },
                },
            ],
        }).compile();

        service = module.get(GooglePlacesService);
    });

    function mockJson(status: number, body: any) {
        return { ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) } as any;
    }

    it('getPlaceDetails: 429 Too Many Requests -> BadGatewayException', async () => {
        mockFetch.mockResolvedValueOnce(mockJson(429, { error: { message: 'rate limit' } }));
        await expect(service.getPlaceDetails('x')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('searchPlace: 401/403 -> UnauthorizedException', async () => {
        mockFetch.mockResolvedValueOnce(mockJson(401, { error: { message: 'unauthorized' } }));
        await expect(service.searchPlace('q')).rejects.toBeInstanceOf(UnauthorizedException);
        mockFetch.mockResolvedValueOnce(mockJson(403, { error: { message: 'forbidden' } }));
        await expect(service.searchPlace('q')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('searchPlace: 429 -> BadGatewayException', async () => {
        mockFetch.mockResolvedValueOnce(mockJson(429, { error: { message: 'rate limit' } }));
        await expect(service.searchPlace('q')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('discoverPlacesNearby: 429 -> BadGatewayException', async () => {
        mockFetch.mockResolvedValueOnce(mockJson(429, { error: { message: 'rate limit' } }));
        await expect(service.discoverPlacesNearby(1, 2, 100, ['cafe'])).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('discoverPlacesByText: INVALID_ARGUMENT with bad page token returns empty result', async () => {
        mockFetch.mockResolvedValueOnce(
            mockJson(400, { error: { status: 'INVALID_ARGUMENT', message: 'bad page token' } }),
        );
        const res = await service.discoverPlacesByText('q', undefined, undefined, undefined, 'bad');
        expect(res).toEqual({ places: [], nextPageToken: undefined });
    });

    it('discoverPlacesByText: 429 -> BadGatewayException', async () => {
        mockFetch.mockResolvedValueOnce(mockJson(429, { error: { message: 'rate limit' } }));
        await expect(service.discoverPlacesByText('q')).rejects.toBeInstanceOf(BadGatewayException);
    });
});


