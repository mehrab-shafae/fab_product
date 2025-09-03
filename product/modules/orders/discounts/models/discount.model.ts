import { Schema, model, Document } from 'mongoose';

export type DiscountType = 'percentage' | 'fixed';

export interface IDiscount extends Document {
      code: string;
      type: DiscountType;
      value: number;
      expiry: Date;
      maxUsage: number;
      usedCount: number;
      active: boolean;
      productIds: string[];
      userIds: string[];
      createdAt: Date;
      updatedAt: Date;
}

const DiscountSchema = new Schema<IDiscount>(
      {
            code: { type: String, required: true, unique: true },
            type: { type: String, enum: ['percentage', 'fixed'], required: true },
            value: { type: Number, required: true },
            expiry: { type: Date, required: true },
            maxUsage: { type: Number, required: true },
            usedCount: { type: Number, default: 0 },
            active: { type: Boolean, default: true },
            productIds: [{ type: String }],
            userIds: [{ type: String }],
      },
      { timestamps: true }
);

export const DiscountModel = model<IDiscount>('OrderDiscount', DiscountSchema);
