import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Place, PlaceDocument } from '../schemas/place.schema';
import { GooglePlacesService } from './google-places.service';

// Helper function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface for defining Istanbul regions
interface IstanbulRegion {
    name: string;
    latitude: number;
    longitude: number;
    radius: number; // in meters
}

// Definition of Istanbul regions (example with 20 smaller regions)
const istanbulRegions: IstanbulRegion[] = [
    { name: 'Sultanahmet Core', latitude: 41.0082, longitude: 28.9784, radius: 3000 },
    { name: 'Eminonu/Sirkeci', latitude: 41.0170, longitude: 28.9750, radius: 3000 },
    { name: 'Fatih West', latitude: 41.0181, longitude: 28.9481, radius: 5000 },
    { name: 'Balat/Fener', latitude: 41.0310, longitude: 28.9480, radius: 4000 },
    { name: 'Taksim/Istiklal', latitude: 41.0360, longitude: 28.9790, radius: 4000 },
    { name: 'Galata/Karakoy', latitude: 41.0250, longitude: 28.9740, radius: 4000 },
    { name: 'Besiktas Center', latitude: 41.0441, longitude: 29.0021, radius: 5000 },
    { name: 'Nisantasi/Sisli', latitude: 41.0550, longitude: 28.9900, radius: 5000 },
    { name: 'Ortakoy', latitude: 41.0490, longitude: 29.0250, radius: 4000 },
    { name: 'Levent/Etiler', latitude: 41.0790, longitude: 29.0150, radius: 6000 },
    { name: 'Kadikoy Center', latitude: 40.9904, longitude: 29.0276, radius: 5000 },
    { name: 'Moda', latitude: 40.9820, longitude: 29.0240, radius: 4000 },
    { name: 'Uskudar Center', latitude: 41.0255, longitude: 29.0166, radius: 5000 },
    { name: 'Kuzguncuk', latitude: 41.0380, longitude: 29.0270, radius: 4000 },
    { name: 'Beylerbeyi/Cengelkoy', latitude: 41.0450, longitude: 29.0400, radius: 5000 },
    { name: 'Bagdat Caddesi (West)', latitude: 40.9670, longitude: 29.0450, radius: 7000 },
    { name: 'Bagdat Caddesi (East)', latitude: 40.9580, longitude: 29.0800, radius: 7000 },
    { name: 'Eyup Sultan', latitude: 41.0475, longitude: 28.9231, radius: 6000 },
    { name: 'Pierre Loti', latitude: 41.0560, longitude: 28.9330, radius: 4000 },
    { name: 'Anadolu Hisari', latitude: 41.0820, longitude: 29.0670, radius: 5000 },
];

@Injectable()
export class DataSyncService {
    private readonly logger = new Logger(DataSyncService.name);
    // Target place types for filtering
    private readonly TARGET_PLACE_TYPES = new Set(['tourist_attraction', 'museum', 'historical_landmark']);
    // Configuration for Nearby Search part
    private readonly NEARBY_MAX_RESULTS_PER_REGION = 30;
    // Configuration for Text Search part
    private readonly TEXT_SEARCH_PAGE_LIMIT = 20; // Max pages per text query
    // Delays to avoid hitting rate limits aggressively
    private readonly DELAY_BETWEEN_REGIONS_MS = 3000; // Delay between Nearby Search regions
    private readonly DELAY_BETWEEN_PAGES_MS = 2000;   // Delay between Text Search pages

    constructor(
        private readonly googlePlacesService: GooglePlacesService,
        @InjectModel(Place.name) private placeModel: Model<PlaceDocument>,
    ) {}

    /**
     * Hybrid Approach: Discovers places using both Nearby Search (regions) and Text Search (queries),
     * filters them, enriches the filtered list with details, and saves/updates them in the DB.
     * @param maxResultsTotal The target number of unique, filtered places to save.
     */
    async hybridSyncPlacesData(
        maxResultsTotal: number = 1000,
    ): Promise<{
        nearbyRaw: number,        // Count of unique places found ONLY by Nearby Search
        textSearchRaw: number,    // Count of unique places found ONLY by Text Search
        totalUniqueRaw: number,   // Total unique places found by both methods before filtering
        filtered: number,         // Count of places matching TARGET_PLACE_TYPES (up to maxResultsTotal)
        enriched: number,         // Count of places successfully enriched with details
        saved: number,            // Count of places successfully saved/updated in DB
        errors: number            // Total errors encountered during the process
    }> {
        this.logger.log(`Starting HYBRID sync process: Target unique places = ${maxResultsTotal}`);
        const initialDbCount = await this.placeModel.countDocuments().exec();
        this.logger.log(`Initial place count in DB: ${initialDbCount}`);

        // Map to store discovered places (placeId -> { id, types }) to handle uniqueness and merge types
        let discoveredPlacesMap = new Map<string, { id: string, types?: string[] }>();
        let nearbyRawCount = 0;       // Counter for places initially found via Nearby
        let textSearchRawCount = 0;   // Counter for places initially found via Text Search
        let errorCount = 0;

        // --- Phase 1A: NEARBY SEARCH (Multiple Regions) ---
        this.logger.log(`Phase 1A: Discovering places using Nearby Search across ${istanbulRegions.length} regions...`);
        for (let i = 0; i < istanbulRegions.length; i++) {
            const region = istanbulRegions[i];
            this.logger.log(` [Nearby Region ${i + 1}/${istanbulRegions.length}] Syncing: ${region.name} (Radius: ${region.radius}m)`);
            let regionUniqueIds = new Set<string>(); // Track unique IDs found in this specific region scan

            // Iterate through target types for each region
            for (const currentType of Array.from(this.TARGET_PLACE_TYPES)) {
                // Stop if we already found enough for this region based on the per-region limit
                if (regionUniqueIds.size >= this.NEARBY_MAX_RESULTS_PER_REGION) {
                    this.logger.log(`   Reached max results per region (${this.NEARBY_MAX_RESULTS_PER_REGION}), skipping type: ${currentType}`);
                    break;
                }
                try {
                    // Call Nearby Search for the current type and region
                    const result = await this.googlePlacesService.discoverPlacesNearby(
                        region.latitude, region.longitude, region.radius, [currentType] // No page token needed usually
                    );

                    let addedInThisCall = 0;
                    result.places.forEach(place => {
                        if (place.id && regionUniqueIds.size < this.NEARBY_MAX_RESULTS_PER_REGION) {
                            if (!discoveredPlacesMap.has(place.id)) {
                                // Add new place to the global map and track counts
                                discoveredPlacesMap.set(place.id, { id: place.id, types: place.types || [] });
                                regionUniqueIds.add(place.id);
                                nearbyRawCount++;
                                addedInThisCall++;
                            } else {
                                // If place already exists, merge types (Nearby might provide different types than Text Search)
                                const existing = discoveredPlacesMap.get(place.id);
                                if (existing && place.types) {
                                    const combinedTypes = new Set([...(existing.types || []), ...place.types]);
                                    existing.types = Array.from(combinedTypes);
                                }
                            }
                        }
                    });
                    this.logger.log(`   [${currentType}] Found ${result.places.length} (${addedInThisCall} new unique). Total unique in map: ${discoveredPlacesMap.size}`);
                } catch (error) {
                    this.logger.error(`Error during Nearby Search for type ${currentType} in region ${region.name}: ${error.message}`);
                    errorCount++;
                }
            } // End type loop for region
            this.logger.log(` [Nearby Region ${i + 1}] Finished. Found ${regionUniqueIds.size} unique places in this region scan.`);
            // Wait before processing the next region
            if (i < istanbulRegions.length - 1) {
                this.logger.log(` Waiting ${this.DELAY_BETWEEN_REGIONS_MS / 1000}s before next region...`);
                await delay(this.DELAY_BETWEEN_REGIONS_MS);
            }
        } // End region loop
        this.logger.log(`Phase 1A (Nearby Search) finished. Total unique raw places found so far: ${discoveredPlacesMap.size}.`);


        // --- Phase 1B: TEXT SEARCH (General Queries + Pagination) ---
        this.logger.log(`Phase 1B: Discovering additional places using Text Search...`);
        // Define text queries to broaden the search
        const textQueries = [
            "İstanbul turistik yerler",
            "İstanbul müzeler",
            "İstanbul tarihi yerler",
            "Istanbul landmarks",
            "Istanbul historical sites"
        ];
        // Define a broad location bias covering Istanbul
        const istanbulBias = { latitude: 41.015137, longitude: 28.979530, radius: 40000 }; // 40km radius

        for (const query of textQueries) {
            // Define a target for raw results (e.g., 1.5 times the final target to allow for filtering)
            const rawResultTarget = maxResultsTotal * 1.5;
            // If we already have enough raw results, skip remaining text queries
            if (discoveredPlacesMap.size >= rawResultTarget) {
                this.logger.log(`Reached sufficient raw results (${discoveredPlacesMap.size}), skipping remaining Text Search queries.`);
                break;
            }

            this.logger.log(` Executing Text Search for query: "${query}"...`);
            let nextPageToken: string | undefined = undefined;
            let pageCount = 0;

            // Paginate through Text Search results
            do {
                pageCount++;
                try {
                    // Call Text Search with query, bias, and potential page token
                    const result = await this.googlePlacesService.discoverPlacesByText(
                        query, istanbulBias.latitude, istanbulBias.longitude, istanbulBias.radius, nextPageToken
                    );

                    let addedInThisPage = 0;
                    result.places.forEach(place => {
                        // Add to map if it's a new ID
                        if (place.id && !discoveredPlacesMap.has(place.id)) {
                            discoveredPlacesMap.set(place.id, { id: place.id, types: place.types || [] });
                            textSearchRawCount++; // Count places initially found via Text Search
                            addedInThisPage++;
                        } else if (place.id && discoveredPlacesMap.has(place.id) && place.types) {
                            // If place exists, merge types
                            const existing = discoveredPlacesMap.get(place.id);
                            if (existing) {
                                const combinedTypes = new Set([...(existing.types || []), ...place.types]);
                                existing.types = Array.from(combinedTypes);
                            }
                        }
                    });

                    nextPageToken = result.nextPageToken;
                    this.logger.log(`   [Query: "${query}" - Page ${pageCount}] Discovered ${result.places.length} (${addedInThisPage} new unique). Total unique map size: ${discoveredPlacesMap.size}. Next page: ${nextPageToken ? 'Yes' : 'No'}`);

                    // Wait between pages if there's a next page token
                    if (nextPageToken) {
                        await delay(this.DELAY_BETWEEN_PAGES_MS);
                    }
                } catch (error) {
                    this.logger.error(`Error during Text Search pagination for query "${query}": ${error.message}`);
                    errorCount++;
                    nextPageToken = undefined; // Stop pagination for this query on error
                }
                // Continue pagination if token exists, we haven't hit the raw target, and haven't exceeded page limit
            } while (nextPageToken && discoveredPlacesMap.size < rawResultTarget && pageCount < this.TEXT_SEARCH_PAGE_LIMIT);

            this.logger.log(` Finished Text Search for query: "${query}".`);
        } // End text query loop
        this.logger.log(`Phase 1B (Text Search) finished. Added ${textSearchRawCount} new unique places. Total unique raw places in map: ${discoveredPlacesMap.size}.`);


        // --- Phase 1.5: FILTERING (Combined Results) ---
        this.logger.log(`Phase 1.5: Filtering ${discoveredPlacesMap.size} combined raw results by target types...`);
        const filteredPlaceIds: string[] = [];
        // Iterate through the map values (place objects with id and types)
        for (const place of discoveredPlacesMap.values()) {
            // Check if the place has any of the target types
            if (place.types && place.types.some(type => this.TARGET_PLACE_TYPES.has(type))) {
                // Add to filtered list if we haven't reached the final target count
                if (filteredPlaceIds.length < maxResultsTotal) {
                    filteredPlaceIds.push(place.id);
                } else {
                    // Stop adding once the target is reached
                    this.logger.log(`Reached target filtered count (${maxResultsTotal}).`);
                    break;
                }
            }
        }
        const filteredCount = filteredPlaceIds.length;
        this.logger.log(`Filtering finished. Kept ${filteredCount} places matching target types.`);


        // --- Phase 2: ENRICHMENT (Filtered IDs) ---
        this.logger.log(`Phase 2: Enriching ${filteredCount} filtered places with details...`);
        if (filteredCount === 0) {
            this.logger.warn('No filtered places found to enrich.');
            // Return summary including counts from discovery phases
            return { nearbyRaw: nearbyRawCount, textSearchRaw: textSearchRawCount, totalUniqueRaw: discoveredPlacesMap.size, filtered: 0, enriched: 0, saved: 0, errors: errorCount };
        }

        // Create promises for fetching details for each filtered Place ID
        const placeDetailsPromises = filteredPlaceIds.map(placeId =>
            this.googlePlacesService.getPlaceDetails(placeId)
                .catch(error => {
                    // Log error for specific Place ID and count it
                    this.logger.error(`Failed to get details for placeId ${placeId}: ${error.message}`);
                    errorCount++;
                    return null; // Return null for failed requests
                })
        );

        // Execute detail requests in parallel and filter out nulls (failed requests)
        const detailedPlaces = (await Promise.all(placeDetailsPromises)).filter((p): p is NonNullable<typeof p> => p !== null);
        this.logger.log(`Enrichment finished. Successfully fetched details for ${detailedPlaces.length} out of ${filteredCount} filtered places.`);


        // --- Phase 3: SAVING (Enriched Data to MongoDB) ---
        this.logger.log(`Phase 3: Saving ${detailedPlaces.length} enriched places to database...`);
        if (detailedPlaces.length === 0) {
            this.logger.warn('No detailed places to save.');
            // Return summary
            return { nearbyRaw: nearbyRawCount, textSearchRaw: textSearchRawCount, totalUniqueRaw: discoveredPlacesMap.size, filtered: filteredCount, enriched: 0, saved: 0, errors: errorCount };
        }

        // Prepare bulk write operations for upserting
        const operations = detailedPlaces.map((placeData) => ({
            updateOne: {
                filter: { id: placeData.id }, // Use Google Place ID as the unique key
                update: { $set: placeData },   // Set all fetched data
                upsert: true,                  // Insert if not found, update if found
            },
        }));

        let savedCount = 0;
        try {
            // Execute bulk write
            const bulkResult = await this.placeModel.bulkWrite(operations);
            // Calculate saved count (includes both inserts and updates)
            savedCount = (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
            this.logger.log(`Database update finished. Saved/Updated ${savedCount} places.`);

            // Log final summary after successful save
            const finalDbCount = await this.placeModel.countDocuments().exec();
            const newlyAdded = finalDbCount - initialDbCount;
            this.logger.log(`Finished HYBRID sync process. Final DB count: ${finalDbCount} (${newlyAdded >= 0 ? newlyAdded : 0} newly added since start). Total errors: ${errorCount}`);

        } catch (error) {
            // Log database write error
            this.logger.error(`Error during database bulk write: ${error.message}`, error.stack);
            errorCount++;
            // Log final summary even if save failed
            const finalDbCount = await this.placeModel.countDocuments().exec();
            this.logger.log(`Finished HYBRID sync process WITH DB ERROR. Final DB count: ${finalDbCount}. Total errors: ${errorCount}`);
        }

        // Return the final summary object
        return {
            nearbyRaw: nearbyRawCount,
            textSearchRaw: textSearchRawCount,
            totalUniqueRaw: discoveredPlacesMap.size,
            filtered: filteredCount,
            enriched: detailedPlaces.length,
            saved: savedCount, // Use calculated saved count
            errors: errorCount,
        };
    }
}