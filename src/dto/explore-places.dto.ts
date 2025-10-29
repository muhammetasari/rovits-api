import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ExplorePlacesDto {
    @IsNotEmpty()
    @IsNumber()
    @Min(-90)
    @Max(90)
    @Type(() => Number) // Query parametreleri string gelir, number'a çevir
    latitude: number; // Merkez Enlem

    @IsNotEmpty()
    @IsNumber()
    @Min(-180)
    @Max(180)
    @Type(() => Number)
    longitude: number; // Merkez Boylam

    @IsNotEmpty()
    @IsNumber()
    @Min(100) // Min 100 metre
    @Max(50000) // Max 50 km (Google sınırı)
    @Type(() => Number)
    radius: number; // Metre cinsinden yarıçap

    @IsOptional() // Opsiyonel, varsayılan 100 olabilir
    @IsNumber()
    @Min(1)
    @Max(100) // Google bir kerede 20 döndürse de, hedefimiz max 100 olsun
    @Type(() => Number)
    maxResults?: number = 100; // İstenen maksimum sonuç sayısı
}