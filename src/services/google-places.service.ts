import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    BadGatewayException,
    UnauthorizedException,
    HttpException, // Bu importun olduğundan emin olun
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

    // Mevcut Metod: Yer Detaylarını Alma (Güncellenmiş FieldMask ile)
    async getPlaceDetails(placeId: string): Promise<any> { // <--- Dönüş tipini daha spesifik yapabilirsiniz (örn: Place DTO)
        try {
            const url = `https://places.googleapis.com/v1/places/${placeId}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    // GÜNCELLENMİŞ: Tam kapsamlı FieldMask
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,types,regularOpeningHours,currentOpeningHours,secondaryOpeningHours,photos,websiteUri,nationalPhoneNumber,businessStatus,googleMapsUri,reviews,editorialSummary,priceLevel,accessibilityOptions'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Google Places API Error (getPlaceDetails):', error);

                if (response.status === 404) {
                    throw new NotFoundException(`Place not found with ID: ${placeId}`);
                }
                // GÜNCELLENMİŞ: 400 durumunu da kontrol et (API Key hatası için)
                if (response.status === 403 || response.status === 401 || response.status === 400) {
                    throw new UnauthorizedException('Failed to authenticate with Google Places API. Check API Key.');
                }
                throw new BadGatewayException('Upstream Google Places API returned an error.');
            }

            return await response.json();

        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Error in getPlaceDetails service:', error);
            // Hata mesajını daha anlamlı hale getirelim
            throw new InternalServerErrorException(error.message || `Failed to fetch details for placeId: ${placeId}`);
        }
    }

    // Mevcut Metod: Yer Arama (searchText)
    async searchPlace(query: string): Promise<any> { // <--- Dönüş tipini daha spesifik yapabilirsiniz
        try {
            const url = 'https://places.googleapis.com/v1/places:searchText';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    // Bu metod için temel bilgiler yeterli
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress'
                },
                body: JSON.stringify({ textQuery: query })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Google Places API Error (searchPlace):', error);

                // GÜNCELLENMİŞ: 400 durumunu da kontrol et (API Key hatası için)
                if (response.status === 403 || response.status === 401 || response.status === 400) {
                    throw new UnauthorizedException('Failed to authenticate with Google Places API. Check API Key.');
                }
                throw new BadGatewayException('Upstream Google Search API returned an error.');
            }

            return await response.json();

        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Error in searchPlace service:', error);
            throw new InternalServerErrorException(error.message || `Failed to search place with query: ${query}`);
        }
    }

    // YENİ METOD: Keşif için searchNearby API'sini kullanır
    async discoverPlaces(
        latitude: number,
        longitude: number,
        radius: number,
        includedTypes: string[],
        pageToken?: string, // Sayfalama için token
    ): Promise<{ places: { id: string, displayName: { text: string } }[], nextPageToken?: string }> {
        try {
            const url = 'https://places.googleapis.com/v1/places:searchNearby';
            const body: any = {
                includedTypes: includedTypes,
                maxResultCount: 20, // Google max 20 döndürür
                locationRestriction: {
                    circle: {
                        center: { latitude, longitude },
                        radius: radius,
                    },
                },
                rankPreference: 'PROMINENCE', // Popülerliğe göre sırala
                languageCode: 'tr', // Türkçe isimleri tercih et
            };

            if (pageToken) {
                body.pageToken = pageToken;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    // Sadece ID ve isim yeterli, detayları sonra alacağız
                    'X-Goog-FieldMask': 'places.id,places.displayName',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Google Places API Error (discoverPlaces):', error);

                // GÜNCELLENMİŞ: 400 durumunu da kontrol et (API Key hatası için)
                if (response.status === 403 || response.status === 401 || response.status === 400) {
                    // PageToken hatası için özel kontrol
                    if (response.status === 400 && error?.error?.message?.includes('INVALID_ARGUMENT') && body.pageToken) {
                        console.warn(`Invalid or expired pageToken: ${body.pageToken}, stopping pagination.`);
                        return { places: [] }; // Boş sonuç döndürerek döngüyü durdur
                    }
                    throw new UnauthorizedException('Failed to authenticate with Google Places API (Nearby). Check API Key.');
                }
                throw new BadGatewayException('Upstream Google Nearby Search API returned an error.');
            }

            const result = await response.json();
            return {
                places: result.places || [], // places alanı boş gelebilir
                nextPageToken: result.nextPageToken
            };

        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Error in discoverPlaces service:', error);
            throw new InternalServerErrorException(error.message || 'Failed to discover places');
        }
    }
}