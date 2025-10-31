import { PlaceSchema } from '../schemas/place.schema';

describe('PlaceSchema', () => {
    it('should require id field', () => {
        const idPath = PlaceSchema.path('id') as any;
        expect(idPath.options.required).toBe(true);
    });

    it('should define 2dsphere index on location', () => {
        const indexes = PlaceSchema.indexes();
        const hasGeo = indexes.some(([fields]) => fields && (fields as any).location === '2dsphere');
        expect(hasGeo).toBe(true);
    });

    it('should define text index on displayName.text and formattedAddress', () => {
        const indexes = PlaceSchema.indexes();
        const hasText = indexes.some(([fields, opts]) =>
            (fields as any)['displayName.text'] === 'text' && (fields as any)['formattedAddress'] === 'text' && (opts as any)?.name === 'TextIndex',
        );
        expect(hasText).toBe(true);
    });
});


