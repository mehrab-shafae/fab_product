import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVariant {
      attributes?: Array<{
            attribute_id: mongoose.Types.ObjectId;
            value: string;
      }>;
      inventory?: {
            stock?: number; // default: 1
            price?: number; // default: 0
      };
      image_ids?: string[];
      sku?: string;
}

export interface IProduct extends Document {
      name: string;
      slug: string;
      description?: string;
      brand?: string;
      brand_model?: string;
      category_id?: mongoose.Types.ObjectId;
      metadata?: Record<string, any>;
      status?: 'active' | 'inactive' | 'draft' | 'archived';
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
      image_ids?: string[];
      img?: string;
      variants?: IProductVariant[];
}

const ProductVariantSchema = new Schema<IProductVariant>(
      {
            attributes: [
                  {
                        attribute_id: { type: Schema.Types.ObjectId, ref: 'ProductAttribute', required: true },
                        value: { type: String, required: true },
                  },
            ],
            inventory: {
                  stock: { type: Number, default: 1 },
                  price: { type: Number, default: 0 },
            },
            image_ids: [{ type: String }],
            sku: { type: String }, // unique: true, required: true (buggy)
      },
      { _id: false }
);

const ProductSchema = new Schema<IProduct>({
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      description: { type: String },
      brand: { type: String },
      brand_model: { type: String },
      category_id: { type: Schema.Types.ObjectId, ref: 'Category' },
      metadata: { type: Schema.Types.Mixed },
      status: { type: String, enum: ['active', 'inactive', 'draft', 'archived'], default: 'active' },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
      image_ids: [{ type: String }],
      img: { type: String },
      variants: [ProductVariantSchema],
});

// Ensure unique sparse index on nested variants.sku instead of schema-level unique which can be unreliable for arrays
// ProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true }); // (buggy)

ProductSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
