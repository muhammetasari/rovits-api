import { Test, TestingModule } from '@nestjs/testing';
import { HealthModule } from '../health/health.module';
import { HealthCheckService } from '@nestjs/terminus';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('HealthController down scenario (e2e-lite)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [HealthModule],
        })
            .overrideProvider(HealthCheckService)
            .useValue({
                check: jest.fn().mockResolvedValue({ status: 'error', details: { memory_heap: { status: 'down' } } }),
            })
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /ready returns error status when indicators fail', async () => {
        const res = await request(app.getHttpServer()).get('/ready');
        expect(res.status).toBe(200); // Terminus returns 200 with status field
        expect(res.body.status).toBe('error');
    });
});


