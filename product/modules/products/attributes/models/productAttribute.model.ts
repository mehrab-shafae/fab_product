import mongoose, { Schema, Document } from 'mongoose';

export interface IProductAttribute extends Document {
  name: string;
  data_type: string;
  options?: string[];
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ProductAttributeSchema = new Schema<IProductAttribute>({
  name: { type: String, required: true },
  data_type: { type: String, required: true },
  options: [{ type: String }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ProductAttributeSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ProductAttribute = mongoose.model<IProductAttribute>('ProductAttribute', ProductAttributeSchema); 