import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlist extends Document {
  user_id: mongoose.Types.ObjectId;
  product_id: mongoose.Types.ObjectId;
  created_at?: Date;
  deleted_at?: Date;
}

const WishlistSchema = new Schema<IWishlist>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  created_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
});

export const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema); 