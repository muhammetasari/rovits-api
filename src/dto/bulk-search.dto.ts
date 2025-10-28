import {
    IsArray,
    ArrayNotEmpty,
    IsString,
    MinLength,
} from 'class-validator';

export class BulkSearchDto {
    @IsArray()
    @ArrayNotEmpty({ message: 'queries dizisi boş olamaz.' })
    @IsString({ each: true, message: 'queries dizisindeki her eleman string olmalıdır.' })
    @MinLength(3, {
        each: true,
        message: 'Her bir sorgu en az 3 karakter uzunluğunda olmalıdır.',
    })
    queries: string[];
}