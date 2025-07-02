import mongoose, { Schema, Document } from 'mongoose';

export interface IProductPriceHistory extends Document {
      product_id: mongoose.Types.ObjectId;
      variant_id?: mongoose.Types.ObjectId;
      price: number;
      change_reason?: string;
      effective_date?: Date;
      discount_percentage?: number;
      currency?: string;
      source?: string;
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}

const ProductPriceHistorySchema = new Schema<IProductPriceHistory>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      variant_id: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
      price: { type: Number, required: true },
      change_reason: { type: String },
      effective_date: { type: Date, default: Date.now },
      discount_percentage: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' },
      source: { type: String, default: 'system' },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

ProductPriceHistorySchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const ProductPriceHistory = mongoose.model<IProductPriceHistory>('ProductPriceHistory', ProductPriceHistorySchema);
