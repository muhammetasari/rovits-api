import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ExplorePlacesDto {
    @IsNotEmpty()
    @IsNumber()
    @Min(-90)
    @Max(90)
    @Type(() => Number)
    latitude: number; // Merkez Enlem

    @IsNotEmpty()
    @IsNumber()
    @Min(-180)
    @Max(180)
    @Type(() => Number)
    longitude: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(100)
    @Max(50000)
    @Type(() => Number)
    radius: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    maxResults?: number = 100;
}