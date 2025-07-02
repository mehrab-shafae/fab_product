import { Schema, model, Document, Types } from 'mongoose';

export interface ICategoryAttributeOption extends Document {
      attributeId: Types.ObjectId;
      value: string;
      order: number;
}

const CategoryAttributeOptionSchema = new Schema<ICategoryAttributeOption>(
      {
            attributeId: { type: Schema.Types.ObjectId, ref: 'CategoryAttribute', required: true },
            value: { type: String, required: true },
            order: { type: Number, default: 0 },
      },
      { timestamps: true }
);

export const CategoryAttributeOption = model<ICategoryAttributeOption>('CategoryAttributeOption', CategoryAttributeOptionSchema);
