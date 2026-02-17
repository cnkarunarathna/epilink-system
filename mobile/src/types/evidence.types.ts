/**
 * Type definitions for Evidence entity
 */

export enum EvidenceStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface Evidence {
  id: string;
  imageUrl: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  status: EvidenceStatus;
  rejectionReason: string | null;
  taskId: string;
  submittedById: string;
  verifiedById: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  submittedBy?: {
    id: string;
    name: string;
    email: string;
  };
  verifiedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreateEvidenceDto {
  imageUrl: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}
