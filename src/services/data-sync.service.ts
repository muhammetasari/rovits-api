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
     */
    async updateMustSeePlaces(
        latitude: number,
        longitude: number,
        radius: number,
        maxResults: number,
    ): Promise<{ discovered: number, enriched: number, saved: number, errors: number }> {
        this.logger.log(`Starting place discovery: lat=${latitude}, lon=${longitude}, r=${radius}, max=${maxResults}`);
        const includedTypes = ['tourist_attraction', 'museum', 'historical_landmark'];
        let allPlaceIds = new Set<string>(); // Tekrarları önlemek için Set kullan
        let nextPageToken: string | undefined = undefined;
        let discoveredCount = 0;
        let errorCount = 0;

        // --- Aşama 1: KEŞİF (Sayfalama ile) ---
        this.logger.log('Phase 1: Discovering place IDs...');
        do {
            try {
                const result = await this.googlePlacesService.discoverPlaces(
                    latitude, longitude, radius, includedTypes, nextPageToken,
                );

                result.places.forEach(place => {
                    if (place.id && allPlaceIds.size < maxResults) {
                        allPlaceIds.add(place.id);
                    }
                });

                discoveredCount += result.places.length;
                nextPageToken = result.nextPageToken;

                this.logger.log(`Discovered ${result.places.length} places (Total unique: ${allPlaceIds.size}). Next page token: ${nextPageToken ? 'Yes' : 'No'}`);

                // Google, nextPageToken'ın hemen kullanılmamasını önerir.
                if (nextPageToken) {
                    await delay(2000); // 2 saniye bekle
                }

            } catch (error) {
                this.logger.error(`Error during discovery phase: ${error.message}`, error.stack);
                errorCount++;
                nextPageToken = undefined; // Hatada döngüyü durdur
            }
        } while (nextPageToken && allPlaceIds.size < maxResults);

        this.logger.log(`Discovery finished. Found ${allPlaceIds.size} unique place IDs.`);

        // --- Aşama 2: ZENGİNLEŞTİRME (Paralel) ---
        this.logger.log('Phase 2: Enriching places with details...');
        const placeDetailsPromises = Array.from(allPlaceIds).map(placeId =>
            this.googlePlacesService.getPlaceDetails(placeId)
                .catch(error => {
                    this.logger.error(`Failed to get details for placeId ${placeId}: ${error.message}`);
                    errorCount++;
                    return null; // Başarısız olanları null olarak işaretle
                })
        );

        // Paralel olarak tüm detayları çek
        const detailedPlaces = (await Promise.all(placeDetailsPromises)).filter(p => p !== null); // null olanları filtrele
        this.logger.log(`Enrichment finished. Successfully fetched details for ${detailedPlaces.length} places.`);


        // --- Aşama 3: KAYIT (MongoDB'ye Toplu Yazma) ---
        this.logger.log('Phase 3: Saving places to database...');
        if (detailedPlaces.length === 0) {
            this.logger.warn('No detailed places to save.');
            return { discovered: allPlaceIds.size, enriched: 0, saved: 0, errors: errorCount };
        }

        // Mongoose bulkWrite ile upsert işlemi
        const operations = detailedPlaces.map((placeData) => ({
            updateOne: {
                filter: { id: placeData.id }, // Google Place ID'ye göre bul
                update: { $set: placeData }, // Gelen veri ile güncelle
                upsert: true, // Eğer yoksa yeni kayıt olarak ekle
            },
        }));

        try {
            const bulkResult = await this.placeModel.bulkWrite(operations);
            const savedCount = bulkResult.upsertedCount + bulkResult.modifiedCount;
            this.logger.log(`Database update finished. Saved/Updated ${savedCount} places.`);

            return {
                discovered: allPlaceIds.size,
                enriched: detailedPlaces.length,
                saved: savedCount,
                errors: errorCount,
            };
        } catch (error) {
            this.logger.error(`Error during database bulk write: ${error.message}`, error.stack);
            errorCount++;
            return {
                discovered: allPlaceIds.size,
                enriched: detailedPlaces.length,
                saved: 0, // DB hatası olduğu için 0
                errors: errorCount,
            };
        }
    }
}