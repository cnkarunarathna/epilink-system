import { IsArray, IsNumber, IsOptional, IsUUID, ArrayNotEmpty } from 'class-validator';

export class RouteTasksDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  taskIds: string[];

  @IsOptional()
  @IsNumber()
  originLat?: number;

  @IsOptional()
  @IsNumber()
  originLng?: number;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSecs: number;
}

export interface RouteResult {
  orderedTaskIds: string[];
  legs: RouteLeg[];
  totalDistanceMeters: number | null;
  totalDurationSecs: number | null;
  polyline: [number, number][];
  routingUnavailable: boolean;
  tasksWithoutLocation: string[];
}
