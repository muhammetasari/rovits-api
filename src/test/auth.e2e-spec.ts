import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { GooglePlacesService } from '../services/google-places.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../auth/roles.enum';

describe('Auth Guards E2E (PlaceFinder)', () => {
    let app: INestApplication;
    let jwtService: JwtService;
    let configService: ConfigService;
    let userToken: string;
    let adminToken: string;

    const googleMock = {
        searchPlace: jest.fn(),
    } as any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(GooglePlacesService)
            .useValue(googleMock)
            .compile();

        app = moduleFixture.createNestApplication();
        jwtService = app.get(JwtService);
        configService = app.get(ConfigService);

        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });
        app.setGlobalPrefix('api', {
            exclude: ['metrics', 'live', 'ready', 'docs'],
        });

        await app.init();

        const jwtPayloadUser = {
            sub: 'test-user-id',
            roles: [Role.User],
        };
        const jwtPayloadAdmin = {
            sub: 'test-admin-id',
            roles: [Role.User, Role.Admin],
        };

        userToken = jwtService.sign(jwtPayloadUser);
        adminToken = jwtService.sign(jwtPayloadAdmin);

        googleMock.searchPlace.mockResolvedValue({ places: [{ id: 'p1' }] });
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /api/v1/place-finder/search (No Token) -> 401 Unauthorized', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/v1/place-finder/search')
            .query({ q: 'Test' });

        expect(res.status).toBe(401);
    });

    it('GET /api/v1/place-finder/search (Invalid Token) -> 401 Unauthorized', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/v1/place-finder/search')
            .query({ q: 'Test' })
            .set('Authorization', 'Bearer invalidtoken123');

        expect(res.status).toBe(401);
    });

    it('GET /api/v1/place-finder/search (Valid User Token) -> 200 OK', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/v1/place-finder/search')
            .query({ q: 'Test' })
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(200);
    });

    it('GET /api/v1/place-finder/debug/search (User Token) -> 403 Forbidden', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/v1/place-finder/debug/search')
            .query({ q: 'Test' })
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
    });


    it('GET /api/v1/place-finder/debug/search (Admin Token) -> 200 OK', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/v1/place-finder/debug/search')
            .query({ q: 'Test' })
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });

    it('GET /api/v1/admin/sync-places (No Key) -> 401 Unauthorized', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/admin/sync-places')
            .send({});

        expect(res.status).toBe(401);
    });

    it('GET /api/v1/admin/sync-places (Invalid Key) -> 401 Unauthorized', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/admin/sync-places')
            .set('x-api-key', 'invalid-key')
            .send({});

        expect(res.status).toBe(401);
    });
});