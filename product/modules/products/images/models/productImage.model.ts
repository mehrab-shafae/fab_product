import mongoose, { Schema, Document } from 'mongoose';

export interface IProductImage extends Document {
  product_id: mongoose.Types.ObjectId;
  variant_id?: mongoose.Types.ObjectId;
  image_id: string;
  is_primary?: boolean;
  order_index?: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ProductImageSchema = new Schema<IProductImage>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant_id: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
  image_id: { type: String, required: true },
  is_primary: { type: Boolean, default: false },
  order_index: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ProductImageSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ProductImage = mongoose.model<IProductImage>('ProductImage', ProductImageSchema); 