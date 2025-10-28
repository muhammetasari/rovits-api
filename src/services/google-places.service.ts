import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    BadGatewayException,
    UnauthorizedException,
    HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GooglePlacesService {
    private apiKey: string;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
        if (!this.apiKey) {
            // API Key yoksa sunucu başlarken hata ver, daha güvenli.
            throw new Error('GOOGLE_PLACES_API_KEY is not defined in environment variables.');
        }
    }

    async getPlaceDetails(placeId: string) {
        try {
            const url = `https://places.googleapis.com/v1/places/${placeId}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,types,regularOpeningHours,currentOpeningHours,photos'
                }
            });

            if (!response.ok) {
                // YENİ: Gelişmiş Hata Yönetimi
                const error = await response.json();
                console.error('Google Places API Error (getPlaceDetails):', error);

                if (response.status === 404) {
                    throw new NotFoundException(`Place not found with ID: ${placeId}`);
                }
                if (response.status === 403 || response.status === 401 || response.status === 400) { // 400 eklendi
                    // Google API Key hatası (genellikle 400, 401 veya 403 döner)
                    throw new UnauthorizedException('Failed to authenticate with Google Places API. Check API Key.');
                }
                // Diğer Google kaynaklı hatalar için
                throw new BadGatewayException('Upstream Google Places API returned an error.');
            }

            return await response.json();

        } catch (error) {
            // YENİ: Hata yakalama
            // Eğer 'fetch'in kendisi (örn. ağ hatası) patlarsa veya
            // bizim fırlattığımız bir HttpException ise tekrar fırlat.
            if (error instanceof HttpException) {
                throw error;
            }

            console.error('Error in getPlaceDetails service:', error);
            throw new InternalServerErrorException(error.message);
        }
    }

    async searchPlace(query: string) {
        try {
            const url = 'https://places.googleapis.com/v1/places:searchText';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
                },
                body: JSON.stringify({ textQuery: query })
            });

            // YENİ: 'searchPlace' için eksik olan response.ok kontrolü eklendi.
            if (!response.ok) {
                const error = await response.json();
                console.error('Google Places API Error (searchPlace):', error);

                if (response.status === 403 || response.status === 401 || response.status === 400) { // 400 eklendi
                    throw new UnauthorizedException('Failed to authenticate with Google Places API. Check API Key.');
                }
                throw new BadGatewayException('Upstream Google Search API returned an error.');
            }

            return await response.json();

        } catch (error) {
            // YENİ: Hata yakalama
            if (error instanceof HttpException) {
                throw error;
            }

            console.error('Error in searchPlace service:', error);
            throw new InternalServerErrorException(error.message);
        }
    }
}