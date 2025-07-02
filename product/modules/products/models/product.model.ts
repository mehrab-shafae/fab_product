import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  category_id?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  status?: 'active' | 'inactive' | 'draft' | 'archived';
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category_id: { type: Schema.Types.ObjectId, ref: 'Category' },
  metadata: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['active', 'inactive', 'draft', 'archived'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ProductSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema); 