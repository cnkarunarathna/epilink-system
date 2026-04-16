import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsIn(['image', 'document'])
  attachmentType?: string;

  /** Opaque client-generated UUID used to match the optimistic UI entry on the sender's device. Not persisted. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientId?: string;
}
