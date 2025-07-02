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
      image_ids?: string[];
      meta_keywords?: string[];
      meta_title?: string;
      meta_description?: string;
      attribute_metadata?: AttributeMetadataInput[];
}

export interface CategoryUpdateInput {
      name?: string;
      slug?: string;
      parentId?: string | null;
      level?: number;
      order?: number;
      status?: CategoryStatus;
      is_featured?: boolean;
      image_ids?: string[];
      meta_keywords?: string[];
      meta_title?: string;
      meta_description?: string;
      attribute_metadata?: AttributeMetadataInput[];
}

export interface CategoryApprovalInput {
      submittedBy?: string;
      approvedBy?: string;
      rejectedBy?: string;
      rejectionReason?: string;
}

export interface AttributeMetadataInput {
      name: string;
      type: 'string' | 'number' | 'enum';
      required?: boolean;
      order?: number;
      options?: AttributeOptionInput[];
}

export interface AttributeOptionInput {
      value: string;
      order?: number;
}
