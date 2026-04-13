import { IsInt, Min, Max } from 'class-validator';

export class CreateReportDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber!: number;
}
