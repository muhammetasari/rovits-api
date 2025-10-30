import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validationSchema } from '../src/config/validation.schema';
import { fail } from '@jest/globals';

describe('ConfigModule Integration (e2e)', () => {
    let app: INestApplication;
    let configService: ConfigService;

    let originalEnv: NodeJS.ProcessEnv;

    beforeAll(async () => {
        originalEnv = { ...process.env };

        process.env.PORT = '3000';
        process.env.CORS_ORIGINS = 'http://localhost:3001';
        process.env.NODE_ENV = 'test';
        process.env.LOG_LEVEL = 'info';
        process.env.INTERNAL_API_KEY = 'test-internal-key-min-32-chars-long';
        process.env.GOOGLE_PLACES_API_KEY = 'test-google-key';
        process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = '6379';

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    validationSchema,
                    validationOptions: {
                        abortEarly: false,
                    },
                }),
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        configService = app.get<ConfigService>(ConfigService);
    });

    afterAll(async () => {
        await app.close();
        process.env = originalEnv;
    });

    describe('Valid Configuration', () => {
        it('should load PORT from environment', () => {
            expect(configService.get<number>('PORT')).toBe(3000);
        });

        it('should load CORS_ORIGINS from environment', () => {
            expect(configService.get<string>('CORS_ORIGINS')).toBe(
                'http://localhost:3001',
            );
        });

        it('should load LOG_LEVEL from environment', () => {
            expect(configService.get<string>('LOG_LEVEL')).toBe('info');
        });

        it('should load NODE_ENV from environment', () => {
            expect(configService.get<string>('NODE_ENV')).toBe('test');
        });

        it('should load DATABASE_URL from environment', () => {
            expect(configService.get<string>('DATABASE_URL')).toBe(
                'mongodb://localhost:27017/test',
            );
        });

        it('should load REDIS configuration from environment', () => {
            expect(configService.get<string>('REDIS_HOST')).toBe('localhost');
            expect(configService.get<number>('REDIS_PORT')).toBe(6379);
        });
    });

    describe('Invalid LOG_LEVEL', () => {
        it('should reject invalid LOG_LEVEL value', async () => {
            const originalLogLevel = process.env.LOG_LEVEL;
            process.env.LOG_LEVEL = 'invalid_level';

            try {
                await Test.createTestingModule({
                    imports: [
                        ConfigModule.forRoot({
                            validationSchema,
                            validationOptions: {
                                abortEarly: true,
                            },
                        }),
                    ],
                }).compile();

                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).toContain('LOG_LEVEL');
            } finally {
                process.env.LOG_LEVEL = originalLogLevel;
            }
        });
    });

    describe('Invalid NODE_ENV', () => {
        it('should reject invalid NODE_ENV value', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'staging';

            try {
                await Test.createTestingModule({
                    imports: [
                        ConfigModule.forRoot({
                            validationSchema,
                            validationOptions: {
                                abortEarly: true,
                            },
                        }),
                    ],
                }).compile();

                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).toContain('NODE_ENV');
            } finally {
                process.env.NODE_ENV = originalNodeEnv;
            }
        });
    });

    describe('Missing Required Variables', () => {
        it('should reject missing CORS_ORIGINS', async () => {
            const originalCorsOrigins = process.env.CORS_ORIGINS;
            delete process.env.CORS_ORIGINS;

            try {
                await Test.createTestingModule({
                    imports: [
                        ConfigModule.forRoot({
                            validationSchema,
                            validationOptions: {
                                abortEarly: true,
                            },
                        }),
                    ],
                }).compile();

                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).toContain('CORS_ORIGINS');
            } finally {
                process.env.CORS_ORIGINS = originalCorsOrigins;
            }
        });

        it('should reject missing INTERNAL_API_KEY', async () => {
            const originalApiKey = process.env.INTERNAL_API_KEY;
            delete process.env.INTERNAL_API_KEY;

            try {
                await Test.createTestingModule({
                    imports: [
                        ConfigModule.forRoot({
                            validationSchema,
                            validationOptions: {
                                abortEarly: true,
                            },
                        }),
                    ],
                }).compile();

                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).toContain('INTERNAL_API_KEY');
            } finally {
                process.env.INTERNAL_API_KEY = originalApiKey;
            }
        });

        it('should reject missing DATABASE_URL', async () => {
            const originalDatabaseUrl = process.env.DATABASE_URL;
            delete process.env.DATABASE_URL;

            try {
                await Test.createTestingModule({
                    imports: [
                        ConfigModule.forRoot({
                            validationSchema,
                            validationOptions: {
                                abortEarly: true,
                            },
                        }),
                    ],
                }).compile();

                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).toContain('DATABASE_URL');
            } finally {
                process.env.DATABASE_URL = originalDatabaseUrl;
            }
        });
    });

    describe('Default Values', () => {
        it('should apply default PORT value', async () => {
            const originalPort = process.env.PORT;
            delete process.env.PORT;

            const moduleFixture = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                    }),
                ],
            }).compile();

            const config = moduleFixture.get<ConfigService>(ConfigService);
            expect(config.get<number>('PORT')).toBe(3000);

            process.env.PORT = originalPort;
        });

        it('should apply default NODE_ENV value', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            delete process.env.NODE_ENV;

            const moduleFixture = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                    }),
                ],
            }).compile();

            const config = moduleFixture.get<ConfigService>(ConfigService);
            expect(config.get<string>('NODE_ENV')).toBe('development');

            process.env.NODE_ENV = originalNodeEnv;
        });

        it('should apply default LOG_LEVEL value', async () => {
            const originalLogLevel = process.env.LOG_LEVEL;
            delete process.env.LOG_LEVEL;

            const moduleFixture = await Test.createTestingModule({
                imports: [
                    ConfigModule.forRoot({
                        validationSchema,
                    }),
                ],
            }).compile();

            const config = moduleFixture.get<ConfigService>(ConfigService);
            expect(config.get<string>('LOG_LEVEL')).toBe('info');

            process.env.LOG_LEVEL = originalLogLevel;
        });
    });
});