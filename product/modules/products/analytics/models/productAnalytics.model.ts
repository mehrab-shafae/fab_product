import mongoose, { Schema, Document } from 'mongoose';

export interface IProductAnalytics extends Document {
  product_id: mongoose.Types.ObjectId;
  views?: number;
  unique_viewers?: number;
  tag_count?: number;
  comment_count?: number;
  chat_count?: number;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  created_at?: Date;
  updated_at?: Date;
}

const ProductAnalyticsSchema = new Schema<IProductAnalytics>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  views: { type: Number, default: 0 },
  unique_viewers: { type: Number, default: 0 },
  tag_count: { type: Number, default: 0 },
  comment_count: { type: Number, default: 0 },
  chat_count: { type: Number, default: 0 },
  avg_price: { type: Number, default: 0 },
  min_price: { type: Number, default: 0 },
  max_price: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

ProductAnalyticsSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ProductAnalytics = mongoose.model<IProductAnalytics>('ProductAnalytics', ProductAnalyticsSchema); 