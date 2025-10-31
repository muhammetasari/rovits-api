import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PlaceFinderController } from './place-finder.controller';
import { GooglePlacesService } from '../services/google-places.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

describe('PlaceFinder E2E (controller-only, auth bypassed)', () => {
    let app: INestApplication;
    const googleMock = {
        searchPlace: jest.fn(),
    } as any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
            controllers: [PlaceFinderController],
            providers: [GooglePlacesService],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .overrideProvider(GooglePlacesService)
            .useValue(googleMock)
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
        app.setGlobalPrefix('api');
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /api/v1/place-finder/search?q=Galata returns simplified result', async () => {
        googleMock.searchPlace.mockResolvedValue({
            places: [{ id: 'p1', displayName: { text: 'Galata' }, formattedAddress: 'Istanbul' }],
        });

        const res = await request(app.getHttpServer()).get('/api/v1/place-finder/search').query({ q: 'Galata' });
        expect(res.status).toBe(200);
        expect(res.body.placeId).toBe('p1');
    });

    it('GET /api/v1/place-finder/search without q yields 400', async () => {
        const res = await request(app.getHttpServer()).get('/api/v1/place-finder/search');
        expect(res.status).toBe(400);
    });
});