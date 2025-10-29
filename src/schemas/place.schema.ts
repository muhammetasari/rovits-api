import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

// Google API'den gelen karmaşık nesneler için alt şemalar/tipler
// Bu, veriyi daha yapısal hale getirir ve TypeScript'te tip güvenliği sağlar.

@Schema({ _id: false }) // Alt dökümanlar için _id oluşturma
class Location {
    @Prop({ type: Number })
    latitude: number;

    @Prop({ type: Number })
    longitude: number;
}

@Schema({ _id: false })
class OpeningHoursPeriodDetail {
    @Prop({ type: Number })
    day: number; // 0=Pazar, 1=Pzt...

    @Prop({ type: Number })
    hour: number;

    @Prop({ type: Number })
    minute: number;

    @Prop({ type: MongooseSchema.Types.Mixed }) // year, month, day gelebilir
    date?: { year: number; month: number; day: number }; // currentOpeningHours'da var
}

@Schema({ _id: false })
class OpeningHoursPeriod {
    @Prop({ type: OpeningHoursPeriodDetail })
    open: OpeningHoursPeriodDetail;

    @Prop({ type: OpeningHoursPeriodDetail })
    close: OpeningHoursPeriodDetail;
}

@Schema({ _id: false })
class OpeningHours {
    @Prop({ type: Boolean })
    openNow?: boolean; // currentOpeningHours'da var

    @Prop({ type: [OpeningHoursPeriod] })
    periods: OpeningHoursPeriod[];

    @Prop({ type: [String] })
    weekdayDescriptions?: string[];

    // secondaryOpeningHours için de geçerli olabilir
    @Prop({ type: String }) // örn: "HOLIDAY"
    type?: string;
}

@Schema({ _id: false })
class PhotoAuthorAttribution {
    @Prop({ type: String })
    displayName: string;

    @Prop({ type: String })
    uri: string;

    @Prop({ type: String })
    photoUri: string;
}

@Schema({ _id: false })
class Photo {
    @Prop({ type: String })
    name: string; // 'places/ChIJ.../photos/AWn5...' formatında

    @Prop({ type: Number })
    widthPx: number;

    @Prop({ type: Number })
    heightPx: number;

    @Prop({ type: [PhotoAuthorAttribution] })
    authorAttributions: PhotoAuthorAttribution[];
}

@Schema({ _id: false })
class AddressComponent {
    @Prop({ type: String })
    longText: string;

    @Prop({ type: String })
    shortText: string;

    @Prop({ type: [String] })
    types: string[]; // ['locality', 'political'] gibi

    @Prop({ type: String })
    languageCode: string;
}

@Schema({ _id: false })
class ReviewAuthorAttribution {
    @Prop({ type: String })
    displayName: string;

    @Prop({ type: String })
    uri: string;

    @Prop({ type: String })
    photoUri: string;
}

@Schema({ _id: false })
class ReviewOriginalText {
    @Prop({ type: String })
    text: string;

    @Prop({ type: String })
    languageCode: string;
}

@Schema({ _id: false })
class Review {
    @Prop({ type: String })
    name: string; // Yorumun unique ID'si

    @Prop({ type: String }) // "2023-10-29T12:00:00Z" gibi
    relativePublishTimeDescription: string;

    @Prop({ type: Number })
    rating: number; // Yorumun puanı (1-5)

    @Prop({ type: ReviewOriginalText })
    originalText?: ReviewOriginalText; // Orijinal yorum metni

    @Prop({ type: ReviewAuthorAttribution })
    authorAttribution?: ReviewAuthorAttribution;

    @Prop({ type: String }) // "2023-10-29T12:00:00Z" gibi
    publishTime: string;
}


@Schema({ _id: false })
class EditorialSummary {
    @Prop({ type: String })
    text: string;

    @Prop({ type: String })
    languageCode: string;
}

@Schema({ _id: false })
class AccessibilityOptions {
    @Prop({ type: Boolean })
    wheelchairAccessibleEntrance?: boolean;

    @Prop({ type: Boolean })
    wheelchairAccessibleParking?: boolean;

    // Google API'den gelebilecek diğer erişilebilirlik alanları eklenebilir
}

@Schema({ _id: false })
class DisplayName {
    @Prop({ type: String })
    text: string;

    @Prop({ type: String })
    languageCode: string;
}

// Ana Place Şeması
@Schema({ collection: 'places', timestamps: true }) // 'places' koleksiyonuna kaydet, createdAt/updatedAt ekle
export class Place {
    // Google'ın Place ID'si bizim primary key'imiz olacak (_id yerine)
    @Prop({ type: String, unique: true, index: true, required: true })
    id: string; // Google Place ID (örn: "ChIJ...")

    @Prop({ type: DisplayName })
    displayName: DisplayName;

    @Prop({ type: String })
    formattedAddress: string;

    @Prop({ type: [AddressComponent] })
    addressComponents: AddressComponent[];

    @Prop({ type: Location })
    location: Location;

    @Prop({ type: Number })
    rating?: number; // Her yerin puanı olmayabilir

    @Prop({ type: Number })
    userRatingCount?: number; // Her yerin puan sayısı olmayabilir

    @Prop({ type: [String] })
    types: string[];

    @Prop({ type: OpeningHours })
    regularOpeningHours?: OpeningHours;

    @Prop({ type: OpeningHours })
    currentOpeningHours?: OpeningHours; // Her zaman bulunmayabilir

    @Prop({ type: [OpeningHours] }) // Birden fazla olabilir (örn: Bayram tatili vs)
    secondaryOpeningHours?: OpeningHours[];

    @Prop({ type: [Photo] })
    photos?: Photo[];

    @Prop({ type: String })
    websiteUri?: string;

    @Prop({ type: String })
    nationalPhoneNumber?: string;

    @Prop({ type: String })
    businessStatus?: string; // örn: "OPERATIONAL"

    @Prop({ type: String })
    googleMapsUri?: string;

    @Prop({ type: [Review] })
    reviews?: Review[]; // Google genellikle en fazla 5 yorum döndürür

    @Prop({ type: EditorialSummary })
    editorialSummary?: EditorialSummary;

    @Prop({ type: Number })
    priceLevel?: number; // 1-4 arası, her yer için geçerli değil

    @Prop({ type: AccessibilityOptions })
    accessibilityOptions?: AccessibilityOptions;
}

export type PlaceDocument = HydratedDocument<Place>;

export const PlaceSchema = SchemaFactory.createForClass(Place);