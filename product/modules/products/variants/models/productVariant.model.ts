import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVariant extends Document {
      product_id: mongoose.Types.ObjectId;
      sku: string;
      name: string;
      price: number;
      stock_quantity?: number;
      attributes?: Record<string, any>;
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      sku: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      stock_quantity: { type: Number, default: 0 },
      attributes: { type: Schema.Types.Mixed },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

ProductVariantSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const ProductVariant = mongoose.model<IProductVariant>('ProductVariant', ProductVariantSchema);
