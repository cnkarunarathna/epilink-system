export interface MessageSenderDto {
  id: string;
  name: string;
  role: string;
}

export interface MessageReadDto {
  userId: string;
  readAt: Date;
}

export interface MessageResponseDto {
  id: string;
  taskId: string;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  sender: MessageSenderDto;
  isSystemMessage: boolean;
  createdAt: Date;
  readBy: MessageReadDto[];
}
