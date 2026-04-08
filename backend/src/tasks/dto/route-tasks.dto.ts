import {
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  ArrayNotEmpty,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class RouteOrderItemDto {
  @IsUUID('4')
  taskId: string;

  @IsInt()
  @Min(1)
  order: number;
}

export class SaveRouteOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RouteOrderItemDto)
  orders: RouteOrderItemDto[];
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
  /** True when the order came from a previously saved route_order (supervisor-set) */
  usedSavedOrder: boolean;
}
