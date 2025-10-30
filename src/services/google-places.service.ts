import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    BadGatewayException,
    UnauthorizedException,
    HttpException,
    BadRequestException,
    Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GooglePlacesService {
    private readonly logger = new Logger(GooglePlacesService.name);
    private apiKey: string;

    private readonly DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,types,regularOpeningHours,currentOpeningHours,photos,websiteUri,nationalPhoneNumber,businessStatus,googleMapsUri,reviews,editorialSummary,priceLevel,accessibilityOptions';
    private readonly SEARCH_PLACE_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress';
    private readonly NEARBY_DISCOVERY_FIELD_MASK = 'places.id,places.types';
    private readonly TEXT_DISCOVERY_FIELD_MASK = 'places.id,places.types';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.error('GOOGLE_PLACES_API_KEY environment variable is not defined!');
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
                    'X-Goog-FieldMask': this.DETAILS_FIELD_MASK
                }
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
                this.logger.error(`Google Places API Error (getPlaceDetails) - Status: ${response.status}`, JSON.stringify(error, null, 2));
                if (response.status === 404) { throw new NotFoundException(`Place not found with ID: ${placeId}`); }
                if (response.status === 400 && error?.error?.status === 'INVALID_ARGUMENT') { throw new BadRequestException(`Invalid request parameters sent to Google API (Details): ${error?.error?.message}`); }
                if (response.status === 403 || response.status === 401 || (response.status === 400 && error?.error?.status !== 'INVALID_ARGUMENT')) { throw new UnauthorizedException('Failed to authenticate with Google Places API (Details). Check API Key or permissions.'); }
                throw new BadGatewayException(`Upstream Google Places API returned status ${response.status}: ${error?.error?.message || 'Unknown upstream error'}`);
            }
            return await response.json();
        } catch (error) {
            if (error instanceof HttpException) { throw error; }
            this.logger.error('Unexpected error in getPlaceDetails service:', error.stack || error.message || error);
            throw new InternalServerErrorException(error.message || 'Failed to get place details due to an unexpected error');
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
                    'X-Goog-FieldMask': this.SEARCH_PLACE_FIELD_MASK
                },
                body: JSON.stringify({ textQuery: query })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
                this.logger.error(`Google Places API Error (searchPlace) - Status: ${response.status}`, JSON.stringify(error, null, 2));
                if (response.status === 403 || response.status === 401 || response.status === 400) {
                    throw new UnauthorizedException(`Failed to authenticate or invalid request for Google Places API (Search). Check API Key/permissions or request format. Message: ${error?.error?.message}`);
                }
                throw new BadGatewayException(`Upstream Google Search API returned status ${response.status}: ${error?.error?.message || 'Unknown upstream error'}`);
            }
            return await response.json();

        } catch (error) {
            if (error instanceof HttpException) { throw error; }
            this.logger.error('Unexpected error in searchPlace service:', error.stack || error.message || error);
            throw new InternalServerErrorException(error.message || 'Failed to search place due to an unexpected error');
        }
    }

    async discoverPlacesNearby(
        latitude: number,
        longitude: number,
        radius: number,
        includedTypes: string[],
    ): Promise<{ places: { id: string, types?: string[] }[] }> {
        try {
            const url = 'https://places.googleapis.com/v1/places:searchNearby';
            const body: any = {
                includedTypes: includedTypes,
                maxResultCount: 20,
                locationRestriction: {
                    circle: {
                        center: { latitude: latitude, longitude: longitude },
                        radius: radius
                    }
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': this.NEARBY_DISCOVERY_FIELD_MASK
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
                this.logger.error(`Google Places API Error (discoverPlacesNearby) - Status: ${response.status}`, JSON.stringify(error, null, 2));
                if (response.status === 403 || response.status === 401) { throw new UnauthorizedException('Failed to authenticate with Google Places API (Nearby). Check API Key.'); }
                if (response.status === 400 && error?.error?.status === 'INVALID_ARGUMENT') {
                    this.logger.warn(`Google API returned INVALID_ARGUMENT (Nearby): ${error?.error?.message}`);
                    throw new BadRequestException(`Invalid request parameters sent to Google API (Nearby): ${error?.error?.message}`);
                }
                throw new BadGatewayException(`Upstream Google Nearby Search API returned status ${response.status}: ${error?.error?.message || 'Unknown upstream error'}`);
            }
            const result = await response.json();
            return { places: result.places || [] };
        } catch (error) {
            if (error instanceof HttpException) { throw error; }
            this.logger.error('Unexpected error in discoverPlacesNearby service:', error.stack || error.message || error);
            throw new InternalServerErrorException(error.message || 'Failed to discover nearby places due to an unexpected error');
        }
    }

    async discoverPlacesByText(
        textQuery: string,
        latitude?: number,
        longitude?: number,
        radius?: number,
        pageToken?: string,
    ): Promise<{ places: { id: string, types?: string[] }[], nextPageToken?: string }> {
        try {
            const url = 'https://places.googleapis.com/v1/places:searchText';
            const body: any = {
                textQuery: textQuery,
                maxResultCount: 20
            };

            if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
                body.locationBias = {
                    circle: {
                        center: { latitude: latitude, longitude: longitude },
                        radius: radius
                    }
                };
            }
            if (pageToken) { body.pageToken = pageToken; }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': this.TEXT_DISCOVERY_FIELD_MASK
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
                this.logger.error(`Google Places API Error (discoverPlacesByText) - Status: ${response.status}`, JSON.stringify(error, null, 2));
                if (response.status === 403 || response.status === 401) { throw new UnauthorizedException('Failed to authenticate with Google Places API (Text Search). Check API Key.'); }
                if (response.status === 400 && error?.error?.status === 'INVALID_ARGUMENT') {
                    this.logger.warn(`Google API returned INVALID_ARGUMENT (Text Search): ${error?.error?.message}`);
                    if (pageToken && error?.error?.message?.toLowerCase().includes('page token')) {
                        this.logger.warn(`Invalid page token detected: ${pageToken}. Stopping pagination for this query.`);
                        return { places: [], nextPageToken: undefined };
                    }
                    throw new BadRequestException(`Invalid request parameters sent to Google API (Text Search): ${error?.error?.message}`);
                }
                throw new BadGatewayException(`Upstream Google Text Search API returned status ${response.status}: ${error?.error?.message || 'Unknown upstream error'}`);
            }
            const result = await response.json();
            return { places: result.places || [], nextPageToken: result.nextPageToken };
        } catch (error) {
            if (error instanceof HttpException) { throw error; }
            this.logger.error('Unexpected error in discoverPlacesByText service:', error.stack || error.message || error);
            throw new InternalServerErrorException(error.message || 'Failed to discover places by text due to an unexpected error');
        }
    }
}