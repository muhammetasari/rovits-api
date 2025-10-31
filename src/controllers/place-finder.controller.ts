import { Controller, Get, Post, Query, Body, HttpCode, HttpStatus, BadRequestException, UseGuards } from '@nestjs/common';
import { GooglePlacesService } from '../services/google-places.service';
import { BulkSearchDto } from '../dto/bulk-search.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@ApiTags('PlaceFinder')
@ApiBearerAuth('BearerAuth')
@Controller('place-finder')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaceFinderController {
    constructor(private googlePlaces: GooglePlacesService) {}

    @Get('search')
    @Roles(Role.User)
    @ApiOperation({
        summary: 'Single Place Search',
        description: 'Performs a simple text search and returns the top matching place (simplified response).'
    })
    @ApiQuery({ name: 'q', description: 'The search query (e.g., "Galata Tower")', type: String, required: true })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Top search result found.',
        schema: {
            example: {
                query: 'Galata Tower',
                placeId: 'ChIJ...',
                name: 'Galata Tower',
                address: 'Bereketzade, Galata Kulesi, 34421 Beyoğlu/İstanbul, Türkiye'
            }
        }
    })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Query parameter "q" is missing.' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Handled by Rfc7807Filter if GoogleAPI throws 404.' })
    @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or missing JWT.' })
    async search(@Query('q') query: string) {
        if (!query) {
            throw new BadRequestException('q parameter required');
        }

        const result = await this.googlePlaces.searchPlace(query);
        return {
            query,
            placeId: result.places?.[0]?.id,
            name: result.places?.[0]?.displayName?.text,
            address: result.places?.[0]?.formattedAddress
        };
    }

    @Post('bulk-search')
    @Roles(Role.User)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Bulk Place Search',
        description: 'Performs multiple text searches in parallel (simplified response).'
    })
    @ApiBody({ type: BulkSearchDto })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Array of search results, one for each query.',
        schema: {
            example: [
                {
                    query: 'Galata Tower',
                    placeId: 'ChIJ...',
                    name: 'Galata Tower',
                    address: '...'
                },
                {
                    query: 'InvalidQueryString',
                    error: 'Not found or request failed'
                }
            ]
        }
    })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request body (e.g., empty array or short strings).' })
    async bulkSearch(@Body() body: BulkSearchDto) {

        const searchPromises = body.queries.map(query => {
            return this.googlePlaces.searchPlace(query)
                .then(result => {
                    return {
                        query,
                        placeId: result.places?.[0]?.id,
                        name: result.places?.[0]?.displayName?.text,
                        address: result.places?.[0]?.formattedAddress
                    };
                })
                .catch(error => {
                    return {
                        query,
                        error: 'Not found or request failed'
                    };
                });
        });

        const results = await Promise.all(searchPromises);
        return results;
    }

    @Get('details')
    @Roles(Role.User)
    @ApiOperation({
        summary: 'Get Full Place Details',
        description: 'Retrieves comprehensive details for a place using either its Google Place ID or by searching its name.'
    })
    @ApiQuery({ name: 'placeId', description: 'Google Place ID (e.g., "ChIJ...")', type: String, required: false })
    @ApiQuery({ name: 'name', description: 'Name of the place to search for (used if placeId is not provided)', type: String, required: false })
    @ApiResponse({ status: HttpStatus.OK, description: 'Full place details.' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Missing both placeId and name parameters.' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Place not found (Handled by Rfc7f807Filter).' })
    async getDetails(
        @Query('placeId') placeId?: string,
        @Query('name') name?: string
    ) {
        if (placeId) {
            return await this.googlePlaces.getPlaceDetails(placeId);
        }

        if (name) {
            const searchResult = await this.googlePlaces.searchPlace(name);
            const foundPlaceId = searchResult.places?.[0]?.id;

            if (!foundPlaceId) {
                throw new BadRequestException(`No place found with provided name: ${name}`);
            }

            const details = await this.googlePlaces.getPlaceDetails(foundPlaceId);

            return {
                ...details,
                _searchInfo: {
                    searchedName: name,
                    foundPlaceId: foundPlaceId
                }
            };
        }

        throw new BadRequestException('placeId or name parameter required');
    }

    @Get('debug/search')
    @Roles(Role.Admin)
    @ApiOperation({
        summary: '[Debug] Raw Search',
        description: 'Returns the raw, unfiltered response from the Google Places Text Search API. (Internal/Debug Use Only - Requires Admin Role)'
    })
    @ApiQuery({ name: 'q', description: 'The search query', type: String, required: true })
    @ApiResponse({ status: HttpStatus.OK, description: 'Raw Google API response.' })
    async debugSearch(@Query('q') query: string) {
        if (!query) {
            throw new BadRequestException('q parameter required');
        }
        return await this.googlePlaces.searchPlace(query);
    }

    @Get('debug/details')
    @Roles(Role.Admin)
    @ApiOperation({
        summary: '[Debug] Raw Details',
        description: 'Returns the raw, unfiltered response from the Google Places Details API. (Internal/Debug Use Only - Requires Admin Role)'
    })
    @ApiQuery({ name: 'placeId', description: 'Google Place ID', type: String, required: true })
    @ApiResponse({ status: HttpStatus.OK, description: 'Raw Google API response.' })
    async debugDetails(@Query('placeId') placeId: string) {
        if (!placeId) {
            throw new BadRequestException('placeId parameter required');
        }
        return await this.googlePlaces.getPlaceDetails(placeId);
    }

    @Get('info')
    @ApiOperation({
        summary: 'API Information',
        description: 'Provides metadata about the API and its available endpoints.'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'API info object.' })
    async getInfo() {
        return {
            service: 'Rovits Place Finder API',
            version: '1.0.0 (PR-006 Integrated)',
            swaggerDocs: '/docs',
            endpoints: {
                production: {
                    search: {
                        method: 'GET',
                        url: '/api/v1/place-finder/search?q={query}',
                        description: 'Tekli yer arama (filtrelenmiş sonuç)',
                        example: '/api/v1/place-finder/search?q=Galata Tower'
                    },
                    bulkSearch: {
                        method: 'POST',
                        url: '/api/v1/place-finder/bulk-search',
                        description: 'Toplu yer arama (Validasyon Aktif)',
                        body: { queries: ['Yer1', 'Yer2'] }
                    },
                    details: {
                        method: 'GET',
                        url: '/api/v1/place-finder/details?placeId={id} veya ?name={name}',
                        description: 'Detaylı bilgi (Hata Yönetimi Aktif)',
                        examples: [
                            '/api/v1/place-finder/details?placeId=ChIJ...',
                            '/api/v1/place-finder/details?name=Galata Tower'
                        ]
                    }
                },
                debug: {
                    debugSearch: {
                        method: 'GET',
                        url: '/api/v1/place-finder/debug/search?q={query}',
                        description: 'Ham Google arama sonucu'
                    },
                    debugDetails: {
                        method: 'GET',
                        url: '/api/v1/place-finder/debug/details?placeId={id}',
                        description: 'Ham Google detay sonucu'
                    }
                },
                admin: {
                    syncPlaces: {
                        method: 'POST',
                        url: '/api/v1/admin/sync-places',
                        description: 'Veritabanı senkronizasyon işini tetikler (ApiKey Gerekli)'
                    }
                },
                observability: {
                    live: { method: 'GET', url: '/live' },
                    ready: { method: 'GET', url: '/ready' },
                    metrics: { method: 'GET', url: '/metrics' },
                }
            }
        };
    }
}