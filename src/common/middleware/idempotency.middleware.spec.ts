import { IdempotencyMiddleware } from './idempotency.middleware';
import { REDIS_CLIENT } from '../../redis/redis.provider';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ConflictException } from '@nestjs/common';

describe('IdempotencyMiddleware', () => {
    let middleware: IdempotencyMiddleware;
    let mockRedis: { get: jest.Mock; set: jest.Mock };
    let mockConfigService: { get: jest.Mock };

    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(async () => {
        mockRedis = {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue('OK'),
        };

        mockConfigService = {
            get: jest.fn().mockReturnValue(3600),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IdempotencyMiddleware,
                {
                    provide: REDIS_CLIENT,
                    useValue: mockRedis,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        middleware = module.get<IdempotencyMiddleware>(IdempotencyMiddleware);

        mockRequest = {
            headers: {},
            method: 'POST',
        };

        mockResponse = {
            status: jest.fn(() => mockResponse) as jest.Mock,
            json: jest.fn(() => mockResponse) as jest.Mock,
            send: jest.fn(() => mockResponse) as jest.Mock,
            setHeader: jest.fn(() => mockResponse) as jest.Mock,
        };
        mockNext = jest.fn();
    });

    it('should skip GET requests', async () => {
        mockRequest.method = 'GET';
        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should skip if no idempotency-key header is present', async () => {
        mockRequest.headers = {};
        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should not skip PATCH requests', async () => {
        mockRequest.method = 'PATCH';
        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should not skip PUT requests', async () => {
        mockRequest.method = 'PUT';
        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should cache the response for POST requests', async () => {
        const key = uuidv4();
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockResolvedValue(null);

        const responseBody = { id: 1, success: true };
        mockResponse.statusCode = 200;

        const originalJson = jest.fn().mockImplementation(() => {
            return mockResponse;
        });
        mockResponse.json = originalJson;

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRedis.get).toHaveBeenCalledWith(`idempotency:${key}`);
        expect(mockNext).toHaveBeenCalledTimes(1);

        mockResponse.json(responseBody);

        expect(originalJson).toHaveBeenCalledWith(responseBody);
        expect(mockRedis.set).toHaveBeenCalledWith(
            `idempotency:${key}`,
            JSON.stringify({ status: 200, body: responseBody }),
            'EX',
            3600,
        );
    });

    it('should cache the response for PATCH requests', async () => {
        const key = uuidv4();
        mockRequest.method = 'PATCH';
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockResolvedValue(null);

        const responseBody = { id: 1, success: true };
        mockResponse.statusCode = 200;

        const originalJson = jest.fn().mockImplementation(() => {
            return mockResponse;
        });
        mockResponse.json = originalJson;

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRedis.get).toHaveBeenCalledWith(`idempotency:${key}`);
        expect(mockNext).toHaveBeenCalledTimes(1);

        mockResponse.json(responseBody);

        expect(originalJson).toHaveBeenCalledWith(responseBody);
        expect(mockRedis.set).toHaveBeenCalledWith(
            `idempotency:${key}`,
            JSON.stringify({ status: 200, body: responseBody }),
            'EX',
            3600,
        );
    });

    it('should cache the response for PUT requests', async () => {
        const key = uuidv4();
        mockRequest.method = 'PUT';
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockResolvedValue(null);

        const responseBody = { id: 1, success: true };
        mockResponse.statusCode = 200;

        const originalJson = jest.fn().mockImplementation(() => {
            return mockResponse;
        });
        mockResponse.json = originalJson;

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRedis.get).toHaveBeenCalledWith(`idempotency:${key}`);
        expect(mockNext).toHaveBeenCalledTimes(1);

        mockResponse.json(responseBody);

        expect(originalJson).toHaveBeenCalledWith(responseBody);
        expect(mockRedis.set).toHaveBeenCalledWith(
            `idempotency:${key}`,
            JSON.stringify({ status: 200, body: responseBody }),
            'EX',
            3600,
        );
    });

    it('should replay cached response if key is found in Redis', async () => {
        const key = uuidv4();
        const cachedResponse = { status: 200, body: { message: 'cached' } };
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockResolvedValue(JSON.stringify(cachedResponse));

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRedis.get).toHaveBeenCalledWith(`idempotency:${key}`);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(cachedResponse.body);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() if key is not found and cache successful (2xx) JSON response', async () => {
        const key = uuidv4();
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockResolvedValue(null);

        const responseBody = { id: 1, success: true };
        mockResponse.statusCode = 201;

        const originalJson = jest.fn().mockImplementation(() => {
            return mockResponse;
        });
        mockResponse.json = originalJson;

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRedis.get).toHaveBeenCalledWith(`idempotency:${key}`);
        expect(mockNext).toHaveBeenCalledTimes(1);

        mockResponse.json(responseBody);

        expect(originalJson).toHaveBeenCalledWith(responseBody);
        expect(mockRedis.set).toHaveBeenCalledWith(
            `idempotency:${key}`,
            JSON.stringify({ status: 201, body: responseBody }),
            'EX',
            3600,
        );
    });

    it('should not cache error (5xx) responses', async () => {
        const key = uuidv4();
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockResolvedValue(null);

        const errorBody = { message: 'Internal Error' };
        mockResponse.statusCode = 500;

        const originalJson = jest.fn().mockImplementation(() => mockResponse);
        mockResponse.json = originalJson;

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledTimes(1);

        mockResponse.json(errorBody);

        expect(originalJson).toHaveBeenCalledWith(errorBody);
        expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should call next with ConflictException if redis fails', async () => {
        const key = uuidv4();
        mockRequest.headers['idempotency-key'] = key;
        mockRedis.get.mockRejectedValue(new Error('Redis down'));

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockRedis.get).toHaveBeenCalledWith(`idempotency:${key}`);
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ConflictException));
        expect((mockNext as jest.Mock).mock.calls[0][0].message).toContain('Idempotency check failed');
    });
});