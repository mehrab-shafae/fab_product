import mongoose, { Schema, Document } from 'mongoose';

export interface IProductComment extends Document {
  product_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  comment: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ProductCommentSchema = new Schema<IProductComment>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ProductCommentSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ProductComment = mongoose.model<IProductComment>('ProductComment', ProductCommentSchema); 