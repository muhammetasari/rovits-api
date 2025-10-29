import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

// Google API'den gelen karmaşık nesneler için alt şemalar/tipler

@Schema({ _id: false })
class Location {
    @Prop({ type: Number })
    latitude: number;

    @Prop({ type: Number })
    longitude: number;
}

@Schema({ _id: false })
class OpeningHoursPeriodDetail {
    @Prop({ type: Number })
    day: number;

    @Prop({ type: Number })
    hour: number;

    @Prop({ type: Number })
    minute: number;

    @Prop({ type: MongooseSchema.Types.Mixed })
    date?: { year: number; month: number; day: number };
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
    openNow?: boolean;

    @Prop({ type: [OpeningHoursPeriod] })
    periods: OpeningHoursPeriod[];

    @Prop({ type: [String] })
    weekdayDescriptions?: string[];

    @Prop({ type: String })
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
    name: string;

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
    longText: string; // Google API'de longText -> longName olarak gelebilir, düzeltme gerekebilir

    @Prop({ type: String })
    shortText: string; // Google API'de shortText -> shortName olarak gelebilir

    @Prop({ type: [String] })
    types: string[];

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
    name: string;

    @Prop({ type: String })
    relativePublishTimeDescription: string;

    @Prop({ type: Number })
    rating: number;

    @Prop({ type: ReviewOriginalText })
    originalText?: ReviewOriginalText;

    @Prop({ type: ReviewAuthorAttribution })
    authorAttribution?: ReviewAuthorAttribution;

    @Prop({ type: String })
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
}

@Schema({ _id: false })
class DisplayName {
    @Prop({ type: String })
    text: string;

    @Prop({ type: String })
    languageCode: string;
}

// Ana Place Şeması
@Schema({ collection: 'places', timestamps: true })
export class Place {
    @Prop({ type: String, unique: true, index: true, required: true })
    id: string;

    @Prop({ type: DisplayName })
    displayName: DisplayName;

    @Prop({ type: String })
    formattedAddress: string;

    @Prop({ type: [AddressComponent] })
    addressComponents: AddressComponent[];

    @Prop({ type: Location })
    location: Location;

    @Prop({ type: Number })
    rating?: number;

    @Prop({ type: Number })
    userRatingCount?: number;

    @Prop({ type: [String] })
    types: string[];

    @Prop({ type: OpeningHours })
    regularOpeningHours?: OpeningHours;

    @Prop({ type: OpeningHours })
    currentOpeningHours?: OpeningHours;

    @Prop({ type: [Photo] })
    photos?: Photo[];

    @Prop({ type: String })
    websiteUri?: string;

    @Prop({ type: String })
    nationalPhoneNumber?: string;

    @Prop({ type: String })
    businessStatus?: string;

    @Prop({ type: String })
    googleMapsUri?: string;

    @Prop({ type: [Review] })
    reviews?: Review[];

    @Prop({ type: EditorialSummary })
    editorialSummary?: EditorialSummary;

    @Prop({ type: String })
    priceLevel?: string;

    @Prop({ type: AccessibilityOptions })
    accessibilityOptions?: AccessibilityOptions;
}

export type PlaceDocument = HydratedDocument<Place>;

export const PlaceSchema = SchemaFactory.createForClass(Place);

PlaceSchema.index({ location: '2dsphere' });
PlaceSchema.index({ types: 1 });