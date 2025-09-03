import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryReservation extends Document {
      productId: mongoose.Types.ObjectId;
      variantId?: mongoose.Types.ObjectId;
      totalStock: number;
      reservedStock: number;
      reservationHistory?: Array<{
            orderId: mongoose.Types.ObjectId;
            quantity: number;
            reservedAt: Date;
            expiresAt: Date;
            status: 'active' | 'expired' | 'finalized';
      }>;
      createdAt: Date;
      updatedAt: Date;
}

const InventoryReservationSchema = new Schema<IInventoryReservation>({
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
      totalStock: { type: Number, required: true },
      reservedStock: { type: Number, required: true, default: 0 },
      reservationHistory: [
            {
                  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
                  quantity: { type: Number, required: true },
                  reservedAt: { type: Date, required: true },
                  expiresAt: { type: Date, required: true },
                  status: { type: String, enum: ['active', 'expired', 'finalized'], default: 'active' },
            },
      ],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
});

InventoryReservationSchema.pre('save', function (next) {
      this.updatedAt = new Date();
      next();
});

export const InventoryReservation = mongoose.model<IInventoryReservation>('InventoryReservation', InventoryReservationSchema);
