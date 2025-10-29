import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Place, PlaceDocument } from '../schemas/place.schema';
import { GooglePlacesService } from './google-places.service';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface IstanbulRegion {
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
}

// 20 Küçük Bölge Tanımı
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
    private readonly TARGET_PLACE_TYPES = new Set(['tourist_attraction', 'museum', 'historical_landmark']);
    private readonly NEARBY_MAX_RESULTS_PER_REGION = 30;
    private readonly TEXT_SEARCH_PAGE_LIMIT = 20; // Artırıldı
    private readonly DELAY_BETWEEN_REGIONS_MS = 3000; // Azaltıldı
    private readonly DELAY_BETWEEN_PAGES_MS = 2000;

    constructor(
        private readonly googlePlacesService: GooglePlacesService,
        @InjectModel(Place.name) private placeModel: Model<PlaceDocument>,
    ) {}

    async hybridSyncPlacesData(
        maxResultsTotal: number = 1000, // Varsayılan hedef 1000
    ): Promise<{
        nearbyRaw: number,
        textSearchRaw: number,
        totalUniqueRaw: number,
        filtered: number,
        enriched: number,
        saved: number,
        errors: number
    }> {
        this.logger.log(`Starting HYBRID sync process: maxTotal=${maxResultsTotal}`);
        const initialDbCount = await this.placeModel.countDocuments().exec();
        this.logger.log(`Initial place count in DB: ${initialDbCount}`);

        let discoveredPlacesMap = new Map<string, { id: string, types?: string[] }>();
        let nearbyRawCount = 0;
        let textSearchRawCount = 0;
        let errorCount = 0;

        // --- Aşama 1A: NEARBY SEARCH ---
        this.logger.log(`Phase 1A: Discovering places using Nearby Search across ${istanbulRegions.length} regions...`);
        for (let i = 0; i < istanbulRegions.length; i++) {
            const region = istanbulRegions[i];
            this.logger.log(` [Nearby Region ${i + 1}/${istanbulRegions.length}] Syncing: ${region.name}`);
            let regionUniqueIds = new Set<string>();
            for (const currentType of Array.from(this.TARGET_PLACE_TYPES)) {
                if (regionUniqueIds.size >= this.NEARBY_MAX_RESULTS_PER_REGION) break;
                try {
                    // discoverPlacesNearby çağrısı (önceki haliyle aynı)
                    const result = await this.googlePlacesService.discoverPlacesNearby(
                        region.latitude, region.longitude, region.radius, [currentType] // nextPageToken genelde null döner
                    );
                    result.places.forEach(place => {
                        if (place.id && regionUniqueIds.size < this.NEARBY_MAX_RESULTS_PER_REGION) {
                            if (!discoveredPlacesMap.has(place.id)) {
                                discoveredPlacesMap.set(place.id, { id: place.id, types: place.types || [] });
                                regionUniqueIds.add(place.id);
                                nearbyRawCount++;
                            } else {
                                // Tipleri birleştirme mantığı
                                const existing = discoveredPlacesMap.get(place.id);
                                if (existing && place.types) {
                                    const combinedTypes = new Set([...(existing.types || []), ...place.types]);
                                    existing.types = Array.from(combinedTypes);
                                }
                            }
                        }
                    });
                    this.logger.log(`   [${currentType}] Found ${result.places.length}. Total unique in map: ${discoveredPlacesMap.size}`);
                } catch (error) {
                    this.logger.error(`Error during Nearby Search for type ${currentType} in region ${region.name}: ${error.message}`);
                    errorCount++;
                }
            } // Tip döngüsü sonu
            this.logger.log(` [Nearby Region ${i + 1}] Finished. Found ${regionUniqueIds.size} new unique places in this region.`);
            if (i < istanbulRegions.length - 1) {
                this.logger.log(` Waiting ${this.DELAY_BETWEEN_REGIONS_MS / 1000}s...`);
                await delay(this.DELAY_BETWEEN_REGIONS_MS);
            }
        } // Bölge döngüsü sonu
        this.logger.log(`Phase 1A (Nearby Search) finished. Total unique raw places found: ${discoveredPlacesMap.size}.`);

        // --- Aşama 1B: TEXT SEARCH ---
        this.logger.log(`Phase 1B: Discovering additional places using Text Search...`);
        // Sorgu listesi genişletildi
        const textQueries = ["İstanbul turistik yerler", "İstanbul müzeler", "İstanbul tarihi yerler", "Istanbul landmarks", "Istanbul historical sites"];
        const istanbulBias = { latitude: 41.015137, longitude: 28.979530, radius: 40000 };

        for (const query of textQueries) {
            const rawResultTarget = maxResultsTotal * 1.5; // Hedefin 1.5 katı
            if (discoveredPlacesMap.size >= rawResultTarget) {
                this.logger.log(`Reached sufficient raw results (${discoveredPlacesMap.size}), skipping remaining Text Search queries.`);
                break;
            }
            this.logger.log(` Executing Text Search for query: "${query}"...`);
            let nextPageToken: string | undefined = undefined;
            let pageCount = 0;

            do {
                pageCount++;
                try {
                    // discoverPlacesByText çağrısı (önceki haliyle aynı)
                    const result = await this.googlePlacesService.discoverPlacesByText(
                        query, istanbulBias.latitude, istanbulBias.longitude, istanbulBias.radius, nextPageToken
                    );
                    let addedInThisPage = 0;
                    result.places.forEach(place => {
                        if (place.id && !discoveredPlacesMap.has(place.id)) {
                            discoveredPlacesMap.set(place.id, { id: place.id, types: place.types || [] });
                            textSearchRawCount++;
                            addedInThisPage++;
                        } else if (place.id && discoveredPlacesMap.has(place.id) && place.types) {
                            // Tipleri birleştirme mantığı
                            const existing = discoveredPlacesMap.get(place.id);
                            if (existing) {
                                const combinedTypes = new Set([...(existing.types || []), ...place.types]);
                                existing.types = Array.from(combinedTypes);
                            }
                        }
                    });
                    nextPageToken = result.nextPageToken;
                    this.logger.log(`   [Query: "${query}" - Page ${pageCount}] Discovered ${result.places.length} (${addedInThisPage} new unique). Total unique: ${discoveredPlacesMap.size}. Next page: ${nextPageToken ? 'Yes' : 'No'}`);
                    if (nextPageToken) { await delay(this.DELAY_BETWEEN_PAGES_MS); }
                } catch (error) {
                    this.logger.error(`Error during Text Search for query "${query}": ${error.message}`);
                    errorCount++;
                    nextPageToken = undefined;
                }
            } while (nextPageToken && discoveredPlacesMap.size < rawResultTarget && pageCount < this.TEXT_SEARCH_PAGE_LIMIT); // Sayfa limiti artırıldı
            this.logger.log(` Finished Text Search for query: "${query}".`);
        } // Sorgu döngüsü sonu
        this.logger.log(`Phase 1B (Text Search) finished. Added ${textSearchRawCount} new unique places. Total unique raw places: ${discoveredPlacesMap.size}.`);

        // --- Aşama 1.5: FİLTRELEME ---
        this.logger.log('Phase 1.5: Filtering combined results by target types...');
        const filteredPlaceIds: string[] = [];
        for (const place of discoveredPlacesMap.values()) {
            if (place.types && place.types.some(type => this.TARGET_PLACE_TYPES.has(type))) {
                // Filtreleme limiti maxResultsTotal oldu
                if (filteredPlaceIds.length < maxResultsTotal) {
                    filteredPlaceIds.push(place.id);
                } else {
                    break;
                }
            }
        }
        const filteredCount = filteredPlaceIds.length;
        this.logger.log(`Filtering finished. Kept ${filteredCount} places matching target types.`);

        // --- Aşama 2: ZENGİNLEŞTİRME ---
        this.logger.log('Phase 2: Enriching filtered places with details...');
        if (filteredCount === 0) {
            this.logger.warn('No filtered places found to enrich.');
            return { nearbyRaw: nearbyRawCount, textSearchRaw: textSearchRawCount, totalUniqueRaw: discoveredPlacesMap.size, filtered: 0, enriched: 0, saved: 0, errors: errorCount };
        }
        // Gerçek getPlaceDetails çağrısı
        const placeDetailsPromises = filteredPlaceIds.map(placeId =>
            this.googlePlacesService.getPlaceDetails(placeId)
                .catch(error => {
                    this.logger.error(`Failed to get details for placeId ${placeId}: ${error.message}`);
                    errorCount++;
                    return null;
                })
        );
        const detailedPlaces = (await Promise.all(placeDetailsPromises)).filter(p => p !== null);
        this.logger.log(`Enrichment finished. Successfully fetched details for ${detailedPlaces.length} places.`);


        // --- Aşama 3: KAYIT ---
        this.logger.log('Phase 3: Saving places to database...');
        if (detailedPlaces.length === 0) {
            this.logger.warn('No detailed places to save.');
            return { nearbyRaw: nearbyRawCount, textSearchRaw: textSearchRawCount, totalUniqueRaw: discoveredPlacesMap.size, filtered: filteredCount, enriched: 0, saved: 0, errors: errorCount };
        }
        const operations = detailedPlaces.map((placeData) => ({
            updateOne: {
                filter: { id: placeData.id },
                update: { $set: placeData },
                upsert: true,
            },
        }));
        try {
            const bulkResult = await this.placeModel.bulkWrite(operations);
            const savedCount = bulkResult.upsertedCount + bulkResult.modifiedCount;
            this.logger.log(`Database update finished. Saved/Updated ${savedCount} places.`);

            const finalDbCount = await this.placeModel.countDocuments().exec();
            const newlyAdded = finalDbCount - initialDbCount;

            this.logger.log(`Finished HYBRID sync process. Final DB count: ${finalDbCount} (${newlyAdded >= 0 ? newlyAdded : 0} newly added). Total errors: ${errorCount}`);

            return {
                nearbyRaw: nearbyRawCount,
                textSearchRaw: textSearchRawCount,
                totalUniqueRaw: discoveredPlacesMap.size,
                filtered: filteredCount,
                enriched: detailedPlaces.length,
                saved: savedCount,
                errors: errorCount,
            };
        } catch (error) {
            this.logger.error(`Error during database bulk write: ${error.message}`, error.stack);
            errorCount++;
            return { nearbyRaw: nearbyRawCount, textSearchRaw: textSearchRawCount, totalUniqueRaw: discoveredPlacesMap.size, filtered: filteredCount, enriched: detailedPlaces.length, saved: 0, errors: errorCount };
        }
    }
}