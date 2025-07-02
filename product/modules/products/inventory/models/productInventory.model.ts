import mongoose, { Schema, Document } from 'mongoose';

export interface IProductInventory extends Document {
  product_id: mongoose.Types.ObjectId;
  variant_id?: mongoose.Types.ObjectId;
  quantity: number;
  reserved_quantity?: number;
  location?: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ProductInventorySchema = new Schema<IProductInventory>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant_id: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
  quantity: { type: Number, required: true },
  reserved_quantity: { type: Number, default: 0 },
  location: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ProductInventorySchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ProductInventory = mongoose.model<IProductInventory>('ProductInventory', ProductInventorySchema); 