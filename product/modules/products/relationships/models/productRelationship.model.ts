import mongoose, { Schema, Document } from 'mongoose';

export interface IProductRelationship extends Document {
      product_id: mongoose.Types.ObjectId;
      related_product_id: mongoose.Types.ObjectId;
      relationship_type: string;
      created_at?: Date;
      deleted_at?: Date;
}

const ProductRelationshipSchema = new Schema<IProductRelationship>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      related_product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      relationship_type: { type: String, required: true },
      created_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

export const ProductRelationship = mongoose.model<IProductRelationship>('ProductRelationship', ProductRelationshipSchema);
