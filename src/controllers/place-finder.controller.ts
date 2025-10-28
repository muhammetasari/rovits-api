import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { GooglePlacesService } from '../services/google-places.service';

@Controller('place-finder')
export class PlaceFinderController {
    constructor(private googlePlaces: GooglePlacesService) {}

    // ========================================
    // PRODUCTION ENDPOINTSd
    // ========================================

    /**
     * Tekli yer arama - Production API
     * URL: /place-finder/search?q=Galata Tower
     */
    @Get('search')
    async search(@Query('q') query: string) {
        if (!query) {
            return { error: 'q parameter required' };
        }
        const result = await this.googlePlaces.searchPlace(query);
        return {
            query,
            placeId: result.places?.[0]?.id,
            name: result.places?.[0]?.displayName?.text,
            address: result.places?.[0]?.formattedAddress
        };
    }

    /**
     * Toplu yer arama - Production API
     * URL: POST /place-finder/bulk-search
     * Body: { "queries": ["Yer1", "Yer2"] }
     */
    @Post('bulk-search')
    async bulkSearch(@Body() body: { queries: string[] }) {
        const results: any[] = [];

        for (const query of body.queries) {
            try {
                const result = await this.googlePlaces.searchPlace(query);
                results.push({
                    query,
                    placeId: result.places?.[0]?.id,
                    name: result.places?.[0]?.displayName?.text,
                    address: result.places?.[0]?.formattedAddress
                });
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                results.push({ query, error: 'Not found' });
            }
        }

        return results;
    }

    /**
     * Detaylı bilgi - Production API
     * URL: /place-finder/details?placeId=xxx veya ?name=Galata Tower
     */
    @Get('details')
    async getDetails(
        @Query('placeId') placeId?: string,
        @Query('name') name?: string
    ) {
        // Öncelik: placeId varsa direkt kullan
        if (placeId) {
            try {
                return await this.googlePlaces.getPlaceDetails(placeId);
            } catch (error) {
                return {
                    error: 'Place not found with provided placeId',
                    placeId
                };
            }
        }

        // placeId yoksa ama name varsa, önce ara sonra detay çek
        if (name) {
            try {
                const searchResult = await this.googlePlaces.searchPlace(name);
                const foundPlaceId = searchResult.places?.[0]?.id;

                if (!foundPlaceId) {
                    return {
                        error: 'No place found with provided name',
                        searchedName: name
                    };
                }

                const details = await this.googlePlaces.getPlaceDetails(foundPlaceId);

                return {
                    ...details,
                    _searchInfo: {
                        searchedName: name,
                        foundPlaceId: foundPlaceId
                    }
                };
            } catch (error) {
                return {
                    error: 'Failed to fetch place details',
                    searchedName: name
                };
            }
        }

        return {
            error: 'placeId or name parameter required',
            usage: {
                byPlaceId: '/place-finder/details?placeId=ChIJ...',
                byName: '/place-finder/details?name=Galata Tower'
            }
        };
    }

    // ========================================
    // DEBUG/TEST ENDPOINTS
    // ========================================

    /**
     * Ham Google arama sonucu - Debug/Test
     * URL: /place-finder/debug/search?q=Galata Tower
     */
    @Get('debug/search')
    async debugSearch(@Query('q') query: string) {
        if (!query) {
            return { error: 'q parameter required' };
        }
        return await this.googlePlaces.searchPlace(query);
    }

    /**
     * Ham Google detay sonucu - Debug/Test
     * URL: /place-finder/debug/details?placeId=xxx
     */
    @Get('debug/details')
    async debugDetails(@Query('placeId') placeId: string) {
        if (!placeId) {
            return { error: 'placeId parameter required' };
        }
        return await this.googlePlaces.getPlaceDetails(placeId);
    }

    // ========================================
    // UTILITY ENDPOINTS
    // ========================================

    /**
     * API durumu ve endpoint listesi
     * URL: /place-finder/info
     */
    @Get('info')
    async getInfo() {
        return {
            service: 'Rovits Place Finder API',
            version: '1.0.0',
            endpoints: {
                production: {
                    search: {
                        method: 'GET',
                        url: '/place-finder/search?q={query}',
                        description: 'Tekli yer arama (filtrelenmiş sonuç)',
                        example: '/place-finder/search?q=Galata Tower'
                    },
                    bulkSearch: {
                        method: 'POST',
                        url: '/place-finder/bulk-search',
                        description: 'Toplu yer arama',
                        body: { queries: ['Yer1', 'Yer2'] }
                    },
                    details: {
                        method: 'GET',
                        url: '/place-finder/details?placeId={id} veya ?name={name}',
                        description: 'Detaylı bilgi (placeId veya isim ile)',
                        examples: [
                            '/place-finder/details?placeId=ChIJ...',
                            '/place-finder/details?name=Galata Tower'
                        ]
                    }
                },
                debug: {
                    debugSearch: {
                        method: 'GET',
                        url: '/place-finder/debug/search?q={query}',
                        description: 'Ham Google arama sonucu'
                    },
                    debugDetails: {
                        method: 'GET',
                        url: '/place-finder/debug/details?placeId={id}',
                        description: 'Ham Google detay sonucu'
                    }
                },
                utility: {
                    info: {
                        method: 'GET',
                        url: '/place-finder/info',
                        description: 'API bilgileri ve endpoint listesi'
                    }
                }
            }
        };
    }
}