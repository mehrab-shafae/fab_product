import { Schema, model, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  parentId?: Types.ObjectId | null;
  level: number;
  order: number;
  status: 'active' | 'inactive' | 'pending' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  level: { type: Number, default: 1 },
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'pending', 'archived'], default: 'active' },
}, { timestamps: true });

export const Category = model<ICategory>('Category', CategorySchema); 