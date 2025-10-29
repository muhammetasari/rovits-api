import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class Rfc7807Filter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest<Request>();
        const res = ctx.getResponse<Response>();

        const isHttp = exception instanceof HttpException;
        const status = isHttp
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const base: any = isHttp ? exception.getResponse() : undefined;
        const detail =
            typeof base === 'object' && base?.message
                ? Array.isArray(base.message)
                    ? base.message.join(', ')
                    : base.message
                : isHttp
                    ? (exception as HttpException).message
                    : 'Internal Server Error';

        // RFC 7807 problem+json
        const problem = {
            type: `https://httpstatuses.com/${status}`,
            title: HttpStatus[status] ?? 'Error',
            status,
            detail,
            instance: req.originalUrl,
        };

        res
            .status(status)
            .header('Content-Type', 'application/problem+json')
            .json(problem);
    }
}
