import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Logger as PinoLogger } from 'nestjs-pino';

describe('Correlation-ID (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        process.env.LOG_LEVEL = 'silent';
        process.env.PORT = '3000';
        process.env.CORS_ORIGINS = '*';
        process.env.INTERNAL_API_KEY = 'test-key-32-chars-long-minimum';
        process.env.GOOGLE_PLACES_API_KEY = 'test-google-key';
        process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = '6379';

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        app.setGlobalPrefix('api', {
            exclude: ['metrics', 'live', 'ready', 'docs'],
        });
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });

        app.useLogger(app.get(PinoLogger));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('GET /live (Non-prefixed route)', () => {
        it('should return X-Correlation-ID header when not provided', async () => {
            const response = await request(app.getHttpServer())
                .get('/live')
                .expect(200);

            expect(response.headers['x-correlation-id']).toBeDefined();
            expect(response.headers['x-correlation-id']).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            );
        });

        it('should return the same X-Correlation-ID when provided in request', async () => {
            const customCorrelationId = '12345678-1234-4567-8901-123456789012';

            const response = await request(app.getHttpServer())
                .get('/live')
                .set('X-Correlation-ID', customCorrelationId)
                .expect(200);

            expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
        });

        it('should generate different correlation IDs for different requests', async () => {
            const response1 = await request(app.getHttpServer())
                .get('/live')
                .expect(200);

            const response2 = await request(app.getHttpServer())
                .get('/live')
                .expect(200);

            expect(response1.headers['x-correlation-id']).toBeDefined();
            expect(response2.headers['x-correlation-id']).toBeDefined();
            expect(response1.headers['x-correlation-id']).not.toBe(
                response2.headers['x-correlation-id'],
            );
        });
    });

    describe('GET /api/v1/place-finder/info (Prefixed route)', () => {
        it('should return X-Correlation-ID header on prefixed routes', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/place-finder/info')
                .expect(200);

            expect(response.headers['x-correlation-id']).toBeDefined();
        });

        it('should return the same X-Correlation-ID when provided on prefixed routes', async () => {
            const customCorrelationId = 'abcdefab-1234-4567-8901-abcdefabcdef';

            const response = await request(app.getHttpServer())
                .get('/api/v1/place-finder/info')
                .set('X-Correlation-ID', customCorrelationId)
                .expect(200);

            expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
        });

        it('should handle lowercase correlation-id header', async () => {
            const customId = 'ffffffff-gggg-4hhh-8iii-jjjjjjjjjjjj';

            const response = await request(app.getHttpServer())
                .get('/live')
                .set('x-correlation-id', customId)
                .expect(200);

            expect(response.headers['x-correlation-id']).toBe(customId);
        });
    });

    describe('UUID v4 Format Validation', () => {
        it('should generate valid UUID v4 format', async () => {
            const response = await request(app.getHttpServer())
                .get('/live')
                .expect(200);

            const correlationId = response.headers['x-correlation-id'];

            const uuidV4Regex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            expect(correlationId).toMatch(uuidV4Regex);

            const versionField = correlationId.split('-')[2];
            expect(versionField[0]).toBe('4');

            const variantField = correlationId.split('-')[3];
            expect(['8', '9', 'a', 'b']).toContain(variantField[0].toLowerCase());
        });
    });
});