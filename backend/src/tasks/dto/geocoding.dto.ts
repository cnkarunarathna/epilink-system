import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GeocodeAddressDto {
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class ReverseGeocodeDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class SearchAddressDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  limit?: number;
}
