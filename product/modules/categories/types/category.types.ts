export type CategoryStatus = 'active' | 'inactive' | 'pending' | 'archived';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  level?: number;
  order?: number;
  status?: CategoryStatus;
  is_featured?: boolean;
}

export interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  level?: number;
  order?: number;
  status?: CategoryStatus;
  is_featured?: boolean;
}

export interface CategoryApprovalInput {
  submittedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
} 