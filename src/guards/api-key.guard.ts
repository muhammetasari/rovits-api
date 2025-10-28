import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const requestKey = request.headers['x-api-key']; // Header'dan anahtarı al

        // .env dosyasından beklenen anahtarı al
        const validKey = this.configService.get<string>('INTERNAL_API_KEY');

        // Anahtarları karşılaştır
        if (requestKey === validKey) {
            return true; // Anahtar geçerliyse, isteğe izin ver
        }

        // Anahtar yoksa veya yanlışsa, 401 Unauthorized hatası fırlat
        throw new UnauthorizedException('Invalid or missing API Key');
    }
}