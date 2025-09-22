import { Schema, model, Document } from 'mongoose';

export type DiscountType = 'percentage' | 'fixed';
export type ProductMode = 'specific' | 'all';
export type UserMode = 'specific' | 'all' | 'one_per_user';

export interface IUsageRecord {
      userId: string;
      productId: string;
      usedAt: Date;
      orderId?: string;
}

export interface IUsageRecordV2 {
      userId: string;
      productIds: string[];
      usedAt: Date;
      orderId?: string;
}

export interface IDiscount extends Document {
      code: string;
      type: DiscountType;
      value: number;
      expiry: Date;
      maxUsage: number;
      usedCount: number;
      active: boolean;
      productMode: ProductMode;
      productIds: string[];
      userMode: UserMode;
      userIds: string[];
      usageRecords: IUsageRecord[];
      usageRecordsV2?: IUsageRecordV2[];
      createdAt: Date;
      updatedAt: Date;
}

const UsageRecordSchema = new Schema<IUsageRecord>(
      {
            userId: { type: String, required: true },
            productId: { type: String, required: true },
            usedAt: { type: Date, default: Date.now },
            orderId: { type: String }
      },
      { _id: false }
);

const UsageRecordV2Schema = new Schema<IUsageRecordV2>(
      {
            userId: { type: String, required: true },
            productIds: [{ type: String, required: true }],
            usedAt: { type: Date, default: Date.now },
            orderId: { type: String }
      },
      { _id: false }
);

const DiscountSchema = new Schema<IDiscount>(
      {
            code: { type: String, required: true, unique: true },
            type: { type: String, enum: ['percentage', 'fixed'], required: true },
            value: { type: Number, required: true },
            expiry: { type: Date, required: true },
            maxUsage: { type: Number, required: true },
            usedCount: { type: Number, default: 0 },
            active: { type: Boolean, default: true },
            productMode: { type: String, enum: ['specific', 'all'], default: 'all' },
            productIds: [{ type: String }],
            userMode: { type: String, enum: ['specific', 'all', 'one_per_user'], default: 'all' },
            userIds: [{ type: String }],
            usageRecords: [UsageRecordSchema],
            usageRecordsV2: [UsageRecordV2Schema]
      },
      { timestamps: true }
);

export const DiscountModel = model<IDiscount>('OrderDiscount', DiscountSchema);
