import { Types } from "mongoose";

// src/modules/orders/order-status.enum.ts
export enum OrderStatus {
      PENDING = 'pending',       // در انتظار پرداخت
      PAID = 'paid',             // پرداخت موفق
      CANCELED = 'canceled',     // لغو شده
      SHIPPED = 'shipped',       // ارسال شده
      DELIVERED = 'delivered',   // تحویل داده شده
      REFUNDED = 'refunded',     // بازگشت وجه
}

export interface IOrderItem {
  product: Types.ObjectId;  // رفرنس به Product
  quantity: number;
  price: number;            // قیمت در زمان خرید
}

export interface IOrder extends Document {
  user: string;     // رفرنس به User
  items: IOrderItem[];
  status: OrderStatus;
  totalPrice: number;       // جمع قیمت اقلام قبل از اعمال تخفیف
  payablePrice: number;     // قیمت قابل پرداخت پس از کسر تخفیف
  discountCode?: string;    // کد تخفیف اعمال‌شده
  discountAmount?: number;  // مبلغ تخفیف اعمال‌شده
  paymentMethod?: string;   // مثلا: "credit_card", "cash_on_delivery"
  shippingAddress?: string; // آدرس ارسال
  createdAt: Date;
  updatedAt: Date;
}
    