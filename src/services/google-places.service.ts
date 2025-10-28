import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GooglePlacesService {
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
  }

  async getPlaceDetails(placeId: string) {
    try {
      console.log('API Key:', this.apiKey ? 'Exists' : 'Missing');
      console.log('Place ID:', placeId);

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
        const error = await response.json();
        console.error('Google Places API Error:', error);
        throw new Error(JSON.stringify(error));
      }

      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      throw error;
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

      return await response.json();
    } catch (error) {
      console.error('Search Error:', error);
      throw error;
    }
  }
}