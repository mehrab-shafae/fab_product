import { Types } from 'mongoose';

export enum OrderStatus {
      RESERVING = 'reserving', // در حال رزرو
      RESERVED = 'reserved', // رزرو شده (در انتظار پرداخت)
      PAYING = 'paying', // در حال پرداخت
      PAID = 'paid', // پرداخت موفق
      CANCELED = 'canceled', // لغو شده
      EXPIRED = 'expired', // منقضی شده (رزرو تایم‌اوت)
      SHIPPED = 'shipped', // ارسال شده
      DELIVERED = 'delivered', // تحویل داده شده
      REFUNDED = 'refunded', // بازگشت وجه
}

export interface IOrderItem {
      product: Types.ObjectId;
      quantity: number;
      price: number;
      variantId?: Types.ObjectId;
}

export interface IOrder extends Document {
      user: string;
      items: IOrderItem[];
      status: OrderStatus;
      totalPrice: number;
      payablePrice: number;
      discountCode?: string;
      discountAmount?: number;
      paymentMethod?: string;
      shippingAddress?: string;
      createdAt: Date;
      updatedAt: Date;
}
