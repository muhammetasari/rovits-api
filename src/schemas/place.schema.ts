import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
class Location { /*...*/ }
@Schema({ _id: false })
class OpeningHoursPeriodDetail { /*...*/ }
@Schema({ _id: false })
class OpeningHoursPeriod { /*...*/ }
@Schema({ _id: false })
class OpeningHours { /*...*/ }
@Schema({ _id: false })
class PhotoAuthorAttribution { /*...*/ }
@Schema({ _id: false })
class Photo { /*...*/ }
@Schema({ _id: false })
class AddressComponent {
    @Prop({ type: String })
    longText: string;
    @Prop({ type: String })
    shortText: string;
    @Prop({ type: [String] })
    types: string[];
    @Prop({ type: String })
    languageCode: string;
}
@Schema({ _id: false })
class ReviewAuthorAttribution { /*...*/ }
@Schema({ _id: false })
class ReviewOriginalText { /*...*/ }
@Schema({ _id: false })
class Review { /*...*/ }
@Schema({ _id: false })
class EditorialSummary { /*...*/ }
@Schema({ _id: false })
class AccessibilityOptions { /*...*/ }
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
    id: string; // Google Place ID

    @Prop({ type: DisplayName, index: true })
    displayName: DisplayName;

    @Prop({ type: String, index: true })
    formattedAddress: string;

    @Prop({ type: [AddressComponent] })
    addressComponents: AddressComponent[];

    @Prop({ type: Location })
    location: Location;

    @Prop({ type: Number })
    rating?: number;

    @Prop({ type: Number })
    userRatingCount?: number;

    @Prop({ type: [String], index: true })
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

    @Prop({ type: String, index: true })
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

PlaceSchema.index(
    { 'displayName.text': 'text', formattedAddress: 'text' },
    { default_language: 'turkish', name: 'TextIndex' }
);

