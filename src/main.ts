import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require('helmet');

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Güvenlik başlıkları
    app.use(helmet());

    // CORS
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
        exposedHeaders: ['Retry-After', 'RateLimit-Remaining'],
    });

    // Validasyon
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidUnknownValues: true,
            forbidNonWhitelisted: true,
            validationError: { target: false },
        }),
    );

    // Versiyonlama
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // Global prefix, fakat health/metrics hariç
    app.setGlobalPrefix('api', {
        exclude: ['metrics', 'live', 'ready'],
    });

    // RFC7807 hata filtresi
    const { Rfc7807Filter } = await import('./common/filters/rfc7807.filter');
    app.useGlobalFilters(new Rfc7807Filter());

    // Graceful shutdown
    app.enableShutdownHooks();

    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
}
bootstrap();
