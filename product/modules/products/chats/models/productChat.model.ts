import mongoose, { Schema, Document } from 'mongoose';

export interface IProductChat extends Document {
  product_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  seller_id: mongoose.Types.ObjectId;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

const ProductChatSchema = new Schema<IProductChat>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  seller_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

ProductChatSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ProductChat = mongoose.model<IProductChat>('ProductChat', ProductChatSchema); 