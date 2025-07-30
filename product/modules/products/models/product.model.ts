import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
      name: string;
      slug: string; // Added slug field
      description?: string;
      price: number;
      category_id?: mongoose.Types.ObjectId;
      metadata?: Record<string, any>;
      status?: 'active' | 'inactive' | 'draft' | 'archived';
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
      image_ids?: string[];
      img?: string;
      sku: number; // کد محصول یکتا و ترتیبی
}

const ProductSchema = new Schema<IProduct>({
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true }, // Added slug field
      description: { type: String },
      price: { type: Number, required: true },
      category_id: { type: Schema.Types.ObjectId, ref: 'Category' },
      metadata: { type: Schema.Types.Mixed },
      status: { type: String, enum: ['active', 'inactive', 'draft', 'archived'], default: 'active' },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
      image_ids: [{ type: String }],
      img: { type: String },
      sku: { type: Number, required: true, unique: true }, // کد محصول یکتا و ترتیبی
});

ProductSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
