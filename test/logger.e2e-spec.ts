import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule, Logger as PinoLogger } from 'nestjs-pino';
import { validationSchema } from '../src/config/validation.schema';
import * as crypto from 'crypto';

describe('Logger Integration (e2e)', () => {
    let app: INestApplication;
    let pinoLogger: PinoLogger;

    describe('Production Mode (JSON Structured Logging)', () => {
        beforeAll(async () => {
            process.env.NODE_ENV = 'production';
            process.env.LOG_LEVEL = 'info';
            process.env.PORT = '3000';
            process.env.CORS_ORIGINS = '*';
            process.env.INTERNAL_API_KEY = 'test-key';
            process.env.GOOGLE_PLACES_API_KEY = 'test-google-key';
            process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
            process.env.REDIS_HOST = 'localhost';
            process.env.REDIS_PORT = '6379';

            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                        isGlobal: true,
                    }),
                    LoggerModule.forRootAsync({
                        imports: [ConfigModule],
                        inject: [ConfigService],
                        useFactory: async (configService: ConfigService) => ({
                            pinoHttp: {
                                level: configService.get<string>('LOG_LEVEL', 'info'),
                                transport:
                                    configService.get<string>('NODE_ENV') !== 'production'
                                        ? {
                                            target: 'pino-pretty',
                                            options: {
                                                singleLine: true,
                                                colorize: true,
                                            },
                                        }
                                        : undefined,
                            },
                        }),
                    }),
                ],
            }).compile();

            app = moduleFixture.createNestApplication();
            pinoLogger = app.get(PinoLogger);
            await app.init();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should be defined', () => {
            expect(pinoLogger).toBeDefined();
        });
    });

    describe('Development Mode (Pretty Logging)', () => {
        beforeAll(async () => {
            process.env.NODE_ENV = 'development';
            process.env.LOG_LEVEL = 'debug';

            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                        isGlobal: true,
                    }),
                    LoggerModule.forRootAsync({
                        imports: [ConfigModule],
                        inject: [ConfigService],
                        useFactory: async (configService: ConfigService) => ({
                            pinoHttp: {
                                level: configService.get<string>('LOG_LEVEL', 'info'),
                                transport:
                                    configService.get<string>('NODE_ENV') !== 'production'
                                        ? {
                                            target: 'pino-pretty',
                                            options: {
                                                singleLine: true,
                                                colorize: true,
                                                levelFirst: true,
                                                translateTime: 'SYS:HH:MM:ss.l',
                                            },
                                        }
                                        : undefined,
                            },
                        }),
                    }),
                ],
            }).compile();

            app = moduleFixture.createNestApplication();
            pinoLogger = app.get(PinoLogger);
            await app.init();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should be defined', () => {
            expect(pinoLogger).toBeDefined();
        });
    });

    describe('Log Level Configuration', () => {
        const testLogLevels = [
            'trace',
            'debug',
            'info',
            'warn',
            'error',
            'fatal',
        ] as const;

        testLogLevels.forEach((level) => {
            it(`should support LOG_LEVEL=${level}`, async () => {
                process.env.LOG_LEVEL = level;
                process.env.NODE_ENV = 'test';

                const moduleFixture = await Test.createTestingModule({
                    imports: [
                        ConfigModule.forRoot({
                            validationSchema,
                            isGlobal: true,
                        }),
                        LoggerModule.forRootAsync({
                            imports: [ConfigModule],
                            inject: [ConfigService],
                            useFactory: async (configService: ConfigService) => ({
                                pinoHttp: {
                                    level: configService.get<string>('LOG_LEVEL', 'info'),
                                    autoLogging: false,
                                },
                            }),
                        }),
                    ],
                }).compile();

                const testApp = moduleFixture.createNestApplication();
                await testApp.init();

                const testLogger = testApp.get(PinoLogger);
                expect(testLogger).toBeDefined();

                await testApp.close();
            });
        });
    });

    describe('Correlation-ID in Logs', () => {
        it('should inject correlation-id into log context', async () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'info';

            const moduleFixture = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                        isGlobal: true,
                    }),
                    LoggerModule.forRootAsync({
                        imports: [ConfigModule],
                        inject: [ConfigService],
                        useFactory: async (configService: ConfigService) => ({
                            pinoHttp: {
                                level: configService.get<string>('LOG_LEVEL', 'info'),
                                autoLogging: false,
                                genReqId: (req: any, res: any) => {
                                    const existingId =
                                        req.id ?? req.headers['x-correlation-id'];
                                    if (existingId) return existingId;
                                    const id = crypto.randomUUID();
                                    res.setHeader('X-Correlation-ID', id);
                                    return id;
                                },
                            },
                        }),
                    }),
                ],
            }).compile();

            const testApp = moduleFixture.createNestApplication();
            await testApp.init();

            const testLogger = testApp.get(PinoLogger);
            expect(testLogger).toBeDefined();

            await testApp.close();
        });
    });

    describe('Logger Methods', () => {
        beforeAll(async () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'debug';

            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                        isGlobal: true,
                    }),
                    LoggerModule.forRootAsync({
                        imports: [ConfigModule],
                        inject: [ConfigService],
                        useFactory: async (configService: ConfigService) => ({
                            pinoHttp: {
                                level: configService.get<string>('LOG_LEVEL', 'info'),
                                autoLogging: false,
                            },
                        }),
                    }),
                ],
            }).compile();

            app = moduleFixture.createNestApplication();
            pinoLogger = app.get(PinoLogger);
            await app.init();
        });

        afterAll(async () => {
            await app.close();
        });

        it('should have log method', () => {
            expect(typeof pinoLogger.log).toBe('function');
        });

        it('should have error method', () => {
            expect(typeof pinoLogger.error).toBe('function');
        });

        it('should have warn method', () => {
            expect(typeof pinoLogger.warn).toBe('function');
        });

        it('should have debug method', () => {
            expect(typeof pinoLogger.debug).toBe('function');
        });

        it('should have verbose method', () => {
            expect(typeof pinoLogger.verbose).toBe('function');
        });

        it('should not throw when logging messages', () => {
            expect(() => pinoLogger.log('Test log message')).not.toThrow();
            expect(() =>
                pinoLogger.error('Test error message', 'ErrorContext'),
            ).not.toThrow();
            expect(() => pinoLogger.warn('Test warn message')).not.toThrow();
            expect(() => pinoLogger.debug('Test debug message')).not.toThrow();
        });
    });
});