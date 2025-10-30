import * as Joi from 'joi';

export const validationSchema = Joi.object({
    // API
    PORT: Joi.number().default(3000),
    CORS_ORIGINS: Joi.string().required(),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),

    // Logging
    LOG_LEVEL: Joi.string()
        .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
        .default('info'),

    // Security
    INTERNAL_API_KEY: Joi.string().required(),
    GOOGLE_PLACES_API_KEY: Joi.string().required(),

    // Infra
    DATABASE_URL: Joi.string().uri().required(),
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().optional().allow(''),
});