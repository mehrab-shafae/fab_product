import { Schema, model, Document, Types } from 'mongoose';
import { CategoryStatus, ApprovalStatus } from '../types/category.types.js';

export interface ICategory extends Document {
      name: string;
      slug: string;
      parentId?: Types.ObjectId | null;
      level: number;
      order: number;
      status: CategoryStatus;
      is_featured?: boolean;
      slug_redirects?: string[];
      approval_status?: ApprovalStatus;
      submitted_by?: string;
      approved_by?: string;
      rejected_by?: string;
      rejection_reason?: string;
      submitted_at?: Date;
      approved_at?: Date;
      rejected_at?: Date;
      image_ids: string[];
      img?: string; // تصویر تکی
      meta_keywords: string[];
      meta_title: string;
      meta_description: string;
      meta_helper?: string[]; // لیست کلیدهای مجاز برای metaHelper محصولات
      createdAt: Date;
      updatedAt: Date;
      baseSku?: number; // مقدار اولیه کدگذاری محصولات این دسته
      categorySku: number; // کد یکتای هر دسته‌بندی
}

const CategorySchema = new Schema<ICategory>(
      {
            name: { type: String, required: true },
            slug: { type: String, required: true, unique: true },
            parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
            level: { type: Number, default: 1 },
            order: { type: Number, default: 0 },
            status: { type: String, enum: ['active', 'inactive', 'pending', 'archived'], default: 'active' },
            is_featured: { type: Boolean, default: false },
            slug_redirects: [{ type: String }],
            approval_status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
            submitted_by: { type: String },
            approved_by: { type: String },
            rejected_by: { type: String },
            rejection_reason: { type: String },
            submitted_at: { type: Date },
            approved_at: { type: Date },
            rejected_at: { type: Date },
            image_ids: [{ type: String }],
            img: { type: String },
            meta_keywords: [{ type: String }],
            meta_title: { type: String },
            meta_description: { type: String },
            meta_helper: [{ type: String }],
            baseSku: { type: Number }, // مقدار اولیه کدگذاری محصولات این دسته
            categorySku: { type: Number, required: true, unique: true }, // کد یکتای هر دسته‌بندی
      },
      { timestamps: true }
);

export const Category = model<ICategory>('Category', CategorySchema);
