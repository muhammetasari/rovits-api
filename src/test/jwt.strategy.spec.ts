import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../auth/jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
    let strategy: JwtStrategy;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'JWT_SECRET') return 'test-secret';
                            if (key === 'JWT_ISSUER') return 'https://test.issuer.com';
                            if (key === 'JWT_AUDIENCE') return 'https://test.audience.com';
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        strategy = module.get<JwtStrategy>(JwtStrategy);
    });

    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    it('should validate and return the payload', async () => {
        const payload = { sub: '12345', username: 'testuser', roles: ['user'] };
        const result = await strategy.validate(payload);
        expect(result).toEqual(payload);
    });
});