import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

class SyncOptionsDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(1000)
    maxResults?: number = 1000;
}

describe('SyncOptionsDto validation', () => {
    it('should allow undefined (use default later in controller)', async () => {
        const dto = plainToInstance(SyncOptionsDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept valid number within range', async () => {
        const dto = plainToInstance(SyncOptionsDto, { maxResults: 200 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject below minimum', async () => {
        const dto = plainToInstance(SyncOptionsDto, { maxResults: 5 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject above maximum', async () => {
        const dto = plainToInstance(SyncOptionsDto, { maxResults: 2000 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-integer', async () => {
        const dto = plainToInstance(SyncOptionsDto, { maxResults: 12.34 as any });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
});


