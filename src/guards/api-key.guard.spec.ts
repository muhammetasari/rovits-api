import { ApiKeyGuard } from './api-key.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function createExecutionContext(headers: Record<string, any>): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => ({ headers }),
        }),
    } as any;
}

describe('ApiKeyGuard', () => {
    const validKey = 'secret-key';

    const configServiceMock = {
        get: jest.fn((key: string) => {
            if (key === 'INTERNAL_API_KEY') return validKey;
            return undefined;
        }),
    } as unknown as ConfigService;

    it('should allow when x-api-key matches INTERNAL_API_KEY', () => {
        const guard = new ApiKeyGuard(configServiceMock);
        const ctx = createExecutionContext({ 'x-api-key': validKey });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should throw Unauthorized when x-api-key is missing', () => {
        const guard = new ApiKeyGuard(configServiceMock);
        const ctx = createExecutionContext({});
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should throw Unauthorized when x-api-key is invalid', () => {
        const guard = new ApiKeyGuard(configServiceMock);
        const ctx = createExecutionContext({ 'x-api-key': 'wrong' });
        expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
});


