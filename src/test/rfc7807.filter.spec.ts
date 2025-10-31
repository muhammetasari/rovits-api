import { Rfc7807Filter } from '../common/filters/rfc7807.filter';
import { ArgumentsHost, BadRequestException, HttpException } from '@nestjs/common';

function createHost(url = '/test') {
    const res: any = {
        status: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    const req: any = { originalUrl: url };
    return {
        switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
        res,
    } as unknown as ArgumentsHost & { res: any };
}

describe('Rfc7807Filter', () => {
    it('should format HttpException to problem+json', () => {
        const filter = new Rfc7807Filter();
        const host = createHost('/bad');
        const ex = new BadRequestException('invalid input');

        filter.catch(ex, host as unknown as ArgumentsHost);

        expect(host.res.status).toHaveBeenCalledWith(400);
        expect(host.res.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
        const payload = host.res.json.mock.calls[0][0];
        expect(payload).toMatchObject({
            status: 400,
            title: 'BAD_REQUEST',
            detail: 'invalid input',
            instance: '/bad',
        });
    });

    it('should format unknown error as 500 Internal Server Error', () => {
        const filter = new Rfc7807Filter();
        const host = createHost('/oops');
        const ex = new Error('boom');

        filter.catch(ex, host as unknown as ArgumentsHost);

        expect(host.res.status).toHaveBeenCalledWith(500);
        const payload = host.res.json.mock.calls[0][0];
        expect(payload.status).toBe(500);
        expect(payload.title).toBe('INTERNAL_SERVER_ERROR');
        expect(payload.detail).toBe('Internal Server Error');
        expect(payload.instance).toBe('/oops');
    });
});


