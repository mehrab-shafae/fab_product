import mongoose, { Schema, Document } from 'mongoose';

export interface IProductReview extends Document {
      product_id: mongoose.Types.ObjectId;
      user_id: mongoose.Types.ObjectId;
      rating: number;
      review_text?: string;
      is_verified?: boolean;
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}

const ProductReviewSchema = new Schema<IProductReview>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      review_text: { type: String },
      is_verified: { type: Boolean, default: false },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

ProductReviewSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const ProductReview = mongoose.model<IProductReview>('ProductReview', ProductReviewSchema);
