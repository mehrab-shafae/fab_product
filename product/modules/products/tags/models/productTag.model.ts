import mongoose, { Schema, Document } from 'mongoose';

export interface IProductTag extends Document {
      product_id: mongoose.Types.ObjectId;
      tag_name: string;
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}

const ProductTagSchema = new Schema<IProductTag>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      tag_name: { type: String, required: true },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

ProductTagSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const ProductTag = mongoose.model<IProductTag>('ProductTag', ProductTagSchema);
