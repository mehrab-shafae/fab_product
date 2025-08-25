import mongoose, { Schema, Document } from 'mongoose';

export interface IProductAttributeValue extends Document {
      product_id: mongoose.Types.ObjectId;
      attribute_id: mongoose.Types.ObjectId;
      value: string;
      created_at?: Date;
      updated_at?: Date;
      deleted_at?: Date;
}

const ProductAttributeValueSchema = new Schema<IProductAttributeValue>({
      product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      attribute_id: { type: Schema.Types.ObjectId, ref: 'CategoryAttribute', required: true }, // TODO("No effect ref")
      value: { type: String, required: true },
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now },
      deleted_at: { type: Date, default: null },
});

ProductAttributeValueSchema.pre('save', function (next) {
      this.updated_at = new Date();
      next();
});

export const ProductAttributeValue = mongoose.model<IProductAttributeValue>('ProductAttributeValue', ProductAttributeValueSchema);
