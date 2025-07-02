import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVersion extends Document {
      product_id: mongoose.Types.ObjectId;
      version_number: string;
      changes: string;
      created_by?: mongoose.Types.ObjectId;
      created_at?: Date;
      deleted_at?: Date;
}

const ProductVersionSchema = new Schema<IProductVersion>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      version_number: { type: String, required: true },
      changes: { type: String, required: true },
      created_by: { type: Schema.Types.ObjectId, ref: 'User' },
      created_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

export const ProductVersion = mongoose.model<IProductVersion>('ProductVersion', ProductVersionSchema);
