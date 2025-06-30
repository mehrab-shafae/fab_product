import { Schema, model, Document, Types } from 'mongoose';

export interface ICategoryAttribute extends Document {
  categoryId: Types.ObjectId;
  name: string;
  type: 'string' | 'number' | 'enum';
  required: boolean;
  order: number;
}

const CategoryAttributeSchema = new Schema<ICategoryAttribute>({
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['string', 'number', 'enum'], required: true },
  required: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

export const CategoryAttribute = model<ICategoryAttribute>('CategoryAttribute', CategoryAttributeSchema); 