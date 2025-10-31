import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HealthModule } from '../health/health.module';
import { MetricsModule } from '../metrics/metrics.module';
import { DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';

describe('Health & Metrics E2E', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleBuilder = Test.createTestingModule({
            imports: [HealthModule, MetricsModule],
        })
            .overrideProvider(MemoryHealthIndicator)
            .useValue({
                checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
            })
            .overrideProvider(DiskHealthIndicator)
            .useValue({
                checkStorage: jest.fn().mockResolvedValue({ disk_root: { status: 'up' } }),
            });

        const moduleFixture: TestingModule = await moduleBuilder.compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /live should return { status: "ok" }', async () => {
        const res = await request(app.getHttpServer()).get('/live');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /ready should return Terminus health with status ok', async () => {
        const res = await request(app.getHttpServer()).get('/ready');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status');
        expect(res.body.status).toBe('ok');
    });

    it('GET /metrics should return Prometheus metrics in text format', async () => {
        const res = await request(app.getHttpServer()).get('/metrics');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(typeof res.text).toBe('string');
        expect(res.text.length).toBeGreaterThan(0);
    });
});


