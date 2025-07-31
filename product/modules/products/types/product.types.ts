import { Document } from 'mongoose';

export interface ProductType extends Document {
      name: string;
      description?: string;
      price: number;
      old_price?: number; // قیمت قدیمی (اختیاری)
      category_id?: string;
      metadata?: Record<string, any>;
      status?: 'active' | 'inactive' | 'draft' | 'archived';
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}
