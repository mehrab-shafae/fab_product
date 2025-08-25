// src/modules/orders/order.schema.ts
import { Schema, model } from 'mongoose';
import { OrderStatus, IOrderItem, IOrder } from '../types/order.types.js';


const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
});

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: String, required: true },
    items: { type: [OrderItemSchema], required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    totalPrice: { type: Number, required: true },
    payablePrice: { type: Number, required: true },
    discountCode: { type: String },
    discountAmount: { type: Number, default: 0 },
    paymentMethod: { type: String },
    shippingAddress: { type: String },
  },
  { timestamps: true }
);

export const OrderModel = model<IOrder>('Order', OrderSchema);
