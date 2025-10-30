import {
    IsArray,
    ArrayNotEmpty,
    IsString,
    MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkSearchDto {
    @ApiProperty({
        description: 'An array of search queries (e.g., place names).',
        example: ['Galata Tower', 'Topkapi Palace'],
        type: [String],
        minLength: 3,
        minItems: 1,
    })
    @IsArray()
    @ArrayNotEmpty({ message: 'queries dizisi boş olamaz.' })
    @IsString({ each: true, message: 'queries dizisindeki her eleman string olmalıdır.' })
    @MinLength(3, {
        each: true,
        message: 'Her bir sorgu en az 3 karakter uzunluğunda olmalıdır.',
    })
    queries: string[];
}