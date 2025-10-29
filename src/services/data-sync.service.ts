import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Place, PlaceDocument } from '../schemas/place.schema';
import { GooglePlacesService } from './google-places.service';

// Basit bir bekleme fonksiyonu
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class DataSyncService {
    private readonly logger = new Logger(DataSyncService.name);

    constructor(
        private readonly googlePlacesService: GooglePlacesService,
        @InjectModel(Place.name) private placeModel: Model<PlaceDocument>,
    ) {}

    /**
     * Belirtilen kriterlere göre yerleri keşfeder, detaylarını alır ve DB'ye kaydeder.
     * Her bir yer tipi için ayrı ayrı arama yapar.
     */
    async updateMustSeePlaces(
        latitude: number,
        longitude: number,
        radius: number,
        maxResults: number,
    ): Promise<{ discovered: number, enriched: number, saved: number, errors: number }> {
        this.logger.log(`Starting place discovery: lat=${latitude}, lon=${longitude}, r=${radius}, max=${maxResults}`);

        // --- YENİ: Sorgulanacak Tipler ---
        const typesToSearch = ['tourist_attraction', 'museum', 'historical_landmark'];

        let allPlaceIds = new Set<string>(); // Tekrarları önlemek için Set kullan
        let totalDiscoveredAcrossTypes = 0;
        let errorCount = 0;

        // --- Aşama 1: KEŞİF (Her Tip İçin Ayrı Sayfalama) ---
        this.logger.log('Phase 1: Discovering place IDs for each type...');

        // --- YENİ: Tipler üzerinde döngü ---
        for (const currentType of typesToSearch) {
            if (allPlaceIds.size >= maxResults) {
                this.logger.log(`Reached maxResults (${maxResults}), skipping remaining types.`);
                break; // Hedefe ulaştıysak diğer tipleri arama
            }

            this.logger.log(`Discovering places for type: ${currentType}...`);
            let nextPageToken: string | undefined = undefined;
            let discoveredForThisType = 0;

            // --- Mevcut Sayfalama Döngüsü (iç döngü oldu) ---
            do {
                try {
                    // Sadece mevcut tipi gönder
                    const result = await this.googlePlacesService.discoverPlaces(
                        latitude, longitude, radius, [currentType], nextPageToken,
                    );

                    let addedInThisPage = 0;
                    result.places.forEach(place => {
                        if (place.id && allPlaceIds.size < maxResults) {
                            // Set sayesinde aynı ID tekrar eklenmez
                            if (!allPlaceIds.has(place.id)) {
                                allPlaceIds.add(place.id);
                                addedInThisPage++;
                            }
                        }
                    });

                    discoveredForThisType += result.places.length;
                    totalDiscoveredAcrossTypes += result.places.length; // Toplam bulunan (tekrar dahil)
                    nextPageToken = result.nextPageToken;

                    this.logger.log(`  [${currentType}] Discovered ${result.places.length} places (${addedInThisPage} new unique added). Total unique: ${allPlaceIds.size}. Next page: ${nextPageToken ? 'Yes' : 'No'}`);

                    if (nextPageToken) {
                        await delay(2000); // Google için bekleme
                    }

                } catch (error) {
                    this.logger.error(`Error during discovery for type ${currentType}: ${error.message}`, error.stack);
                    errorCount++;
                    nextPageToken = undefined; // Hatada bu tip için döngüyü durdur
                }
                // Döngü koşulu: Bir sonraki sayfa varsa VE henüz hedefe ulaşmadıysak
            } while (nextPageToken && allPlaceIds.size < maxResults);
            // --- İç Sayfalama Döngüsü Sonu ---

            this.logger.log(`Finished discovery for type: ${currentType}. Found ${discoveredForThisType} places.`);

        } // --- Dış Tip Döngüsü Sonu ---

        this.logger.log(`Discovery finished across all types. Found ${allPlaceIds.size} unique place IDs.`);

        // --- Aşama 2: ZENGİNLEŞTİRME (Aynı Kaldı) ---
        this.logger.log('Phase 2: Enriching places with details...');
        if (allPlaceIds.size === 0) {
            this.logger.warn('No places found to enrich.');
            // Hata varsa yine de raporla
            return { discovered: 0, enriched: 0, saved: 0, errors: errorCount };
        }

        const placeDetailsPromises = Array.from(allPlaceIds).map(placeId =>
            this.googlePlacesService.getPlaceDetails(placeId)
                .catch(error => {
                    this.logger.error(`Failed to get details for placeId ${placeId}: ${error.message}`);
                    errorCount++;
                    return null;
                })
        );

        const detailedPlaces = (await Promise.all(placeDetailsPromises)).filter(p => p !== null);
        this.logger.log(`Enrichment finished. Successfully fetched details for ${detailedPlaces.length} places.`);


        // --- Aşama 3: KAYIT (Aynı Kaldı) ---
        this.logger.log('Phase 3: Saving places to database...');
        if (detailedPlaces.length === 0) {
            this.logger.warn('No detailed places to save.');
            // Hata varsa yine de raporla
            return { discovered: allPlaceIds.size, enriched: 0, saved: 0, errors: errorCount };
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

            return {
                discovered: allPlaceIds.size, // Benzersiz bulunan ID sayısı
                enriched: detailedPlaces.length, // Detayı başarıyla çekilen
                saved: savedCount, // DB'ye yazılan/güncellenen
                errors: errorCount, // Tüm süreçteki toplam hata sayısı
            };
        } catch (error) {
            this.logger.error(`Error during database bulk write: ${error.message}`, error.stack);
            errorCount++;
            return {
                discovered: allPlaceIds.size,
                enriched: detailedPlaces.length,
                saved: 0,
                errors: errorCount,
            };
        }
    }
}