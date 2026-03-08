import { IsString, IsOptional, IsNumber, MaxLength } from 'class-validator';

export class CreateEvidenceDto {
  @IsString()
  imageUrl: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
}
