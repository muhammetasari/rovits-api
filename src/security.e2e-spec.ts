import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { GooglePlacesService } from './services/google-places.service';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_CLIENT } from './redis/redis.provider';
import { Redis } from 'ioredis';

describe('Security and Resilience E2E Tests', () => {
    let app: INestApplication;
    let redisClient: Redis;
    const mockGooglePlacesService = {
        searchPlace: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                AppModule,
            ],
        })
        .overrideGuard(APP_GUARD)
        .useClass(ThrottlerGuard)
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true }) // Mock to always allow access
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true }) // Mock to always allow access
        .overrideProvider(GooglePlacesService)
        .useValue(mockGooglePlacesService)
        .compile();

        app = moduleFixture.createNestApplication();
        
        // Configure app prefixes and versioning
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });
        app.setGlobalPrefix('api', {
            exclude: ['metrics', 'live', 'ready', 'docs'],
        });

        // Add validation pipes
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidUnknownValues: true,
            forbidNonWhitelisted: true,
        }));

        await app.init();

        // Setup Redis for Throttler
        redisClient = app.get<Redis>(REDIS_CLIENT);
    });

    afterAll(async () => {
        await redisClient.quit();
        await app.close();
    });

    beforeEach(() => {
        // Clear mocks before each test
        mockGooglePlacesService.searchPlace.mockClear();
    });

    it('ThrottlerGuard: should block requests after exceeding the rate limit', async () => {
        // Use a unique endpoint to avoid rate limit conflicts with other tests
        const endpoint = '/api/v1/place-finder/search?q=throttle-unique-' + Date.now();

        // Mock the service to return a valid response
        mockGooglePlacesService.searchPlace.mockResolvedValue({
            places: [{ id: 'p1', displayName: { text: 'Test' }, formattedAddress: 'Test Address' }],
        });

        // These 3 requests should succeed (within rate limit)
        await request(app.getHttpServer()).get(endpoint).expect(200);
        await request(app.getHttpServer()).get(endpoint).expect(200);
        await request(app.getHttpServer()).get(endpoint).expect(200);

        // This 4th request should be blocked (exceeds rate limit)
        const response = await request(app.getHttpServer()).get(endpoint);
        expect(response.status).toBe(429);
        expect(response.body.message).toContain('Too Many Requests');
        expect(response.headers).toHaveProperty('retry-after');
    });

    it('Request Size Limit: should return 413 for payloads larger than the limit', async () => {
        // Create a payload larger than the default limit (e.g., > 100kb)
        const largePayload = { data: 'a'.repeat(1024 * 1024) }; // 1MB payload

        const response = await request(app.getHttpServer())
            .post('/api/v1/place-finder/bulk-search')
            .send(largePayload);

        expect(response.status).toBe(413);
        // Express returns 413 with a plain text or JSON error message
        // The important thing is that the status code is 413
        expect(response.status).toBe(413);
    });

    it('Idempotency Middleware: should cache the response on the first request and replay it on subsequent requests', async () => {
        const idempotencyKey = uuidv4();
        const endpoint = '/api/v1/place-finder/bulk-search';
        const requestBody = { queries: ['Istanbul'] };

        // Mock the external service call
        mockGooglePlacesService.searchPlace.mockResolvedValue({
            places: [{ id: 'place_123', displayName: { text: 'Istanbul' }, formattedAddress: 'Istanbul, Turkey' }],
        });

        // 1. First Request
        const firstResponse = await request(app.getHttpServer())
            .post(endpoint)
            .set('Idempotency-Key', idempotencyKey)
            .send(requestBody);

        expect(firstResponse.status).toBe(200);
        expect(firstResponse.body).toHaveLength(1);
        const firstResponseBody = firstResponse.body[0];
        expect(firstResponseBody).toMatchObject({
            query: 'Istanbul',
            placeId: 'place_123',
            name: 'Istanbul',
            address: 'Istanbul, Turkey'
        });
        expect(firstResponse.headers).not.toHaveProperty('idempotency-replayed');
        expect(mockGooglePlacesService.searchPlace).toHaveBeenCalledTimes(1);

        // Clear mock for the next call verification
        mockGooglePlacesService.searchPlace.mockClear();

        // 2. Second Request with the same Idempotency-Key but different body
        // The middleware should return the cached response, ignoring the new body
        const secondResponse = await request(app.getHttpServer())
            .post(endpoint)
            .set('Idempotency-Key', idempotencyKey)
            .send({ queries: ['Ankara'] }); // Different body to prove it's replaying

        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body).toHaveLength(1);
        // The cached response should be identical to the first response
        expect(secondResponse.body[0]).toEqual(firstResponseBody);
        expect(secondResponse.headers).toHaveProperty('idempotency-replayed', 'true');
        expect(mockGooglePlacesService.searchPlace).not.toHaveBeenCalled(); // Service should not be called again
    });
});
