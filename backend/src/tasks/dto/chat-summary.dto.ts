import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ChatSummaryQueryDto {
  /** Comma-separated task statuses, e.g. "pending,assigned,in_progress" */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export interface LastMessageInfo {
  content: string;
  senderName: string;
  sentAt: string;
  isSystemMessage: boolean;
}

export interface ChatSummaryItemDto {
  taskId: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  district: string;
  assignedPhi: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  lastMessage: LastMessageInfo | null;
  unreadCount: number;
  hasMessages: boolean;
}

export interface ChatSummaryResponseDto {
  items: ChatSummaryItemDto[];
  total: number;
}
