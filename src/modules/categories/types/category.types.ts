export type CategoryStatus = 'active' | 'inactive' | 'pending' | 'archived';

export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  level?: number;
  order?: number;
  status?: CategoryStatus;
}

export interface CategoryUpdateInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  level?: number;
  order?: number;
  status?: CategoryStatus;
} 