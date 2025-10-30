import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Rfc7807Filter } from './common/filters/rfc7807.filter';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: [`'self'`],
                    scriptSrc: [`'self'`, `'unsafe-inline'`],
                    styleSrc: [`'self'`, `'unsafe-inline'`],
                    imgSrc: [`'self'`, `data:`],
                    connectSrc: [`'self'`],
                    fontSrc: [`'self'`],
                    objectSrc: [`'none'`],
                    frameAncestors: [`'none'`],
                },
            },
        }),
    );

    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
        exposedHeaders: ['Retry-After', 'RateLimit-Remaining'],
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidUnknownValues: true,
            forbidNonWhitelisted: true,
            validationError: { target: false },
        }),
    );

    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    app.setGlobalPrefix('api', {
        exclude: ['metrics', 'live', 'ready', 'docs'],
    });

    app.useGlobalFilters(new Rfc7807Filter());

    const config = new DocumentBuilder()
        .setTitle('Rovits API')
        .setDescription('Rovits Place Finder API - Google Places Integration')
        .setVersion('1.0')
        .addTag('PlaceFinder', 'Endpoints for searching and retrieving place data')
        .addTag('Admin', 'Internal administrative endpoints')
        .addApiKey(
            { type: 'apiKey', name: 'x-api-key', in: 'header' },
            'ApiKeyAuth',
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    });

    app.enableShutdownHooks();

    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
}
bootstrap();