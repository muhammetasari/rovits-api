import * as Joi from 'joi';

export const validationSchema = Joi.object({
    PORT: Joi.number().default(3000),
    CORS_ORIGINS: Joi.string().required(),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),

    LOG_LEVEL: Joi.string()
        .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
        .default('info'),

    INTERNAL_API_KEY: Joi.string().required(),
    GOOGLE_PLACES_API_KEY: Joi.string().required(),

    JWT_SECRET: Joi.string().required(),
    JWT_ISSUER: Joi.string().uri().required(),
    JWT_AUDIENCE: Joi.string().uri().required(),

    DATABASE_URL: Joi.string().uri().required(),
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().optional().allow(''),
});