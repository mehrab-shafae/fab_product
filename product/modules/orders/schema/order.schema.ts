import * as yup from 'yup';
import { OrderStatus } from '../types/order.types.js';

export const createOrderSchema = yup.object({
      user: yup.string().optional(),
      items: yup
            .array()
            .of(
                  yup.object({
                        sku: yup.string().trim().required('شناسه SKU الزامی است'),
                        quantity: yup.number().positive('تعداد باید مثبت باشد').required('تعداد الزامی است'),
                  })
            )
            .min(1, 'حداقل یک محصول باید در سفارش باشد')
            .required('محصولات الزامی هستند'),
      status: yup.string().oneOf(Object.values(OrderStatus)).default(OrderStatus.PENDING),
      totalPrice: yup.number().positive('مجموع قیمت باید مثبت باشد').optional(),
      discountCode: yup.string().optional(),
      discountAmount: yup.number().min(0, 'مبلغ تخفیف نمی‌تواند منفی باشد').default(0).optional(),
      payablePrice: yup.number().positive('قیمت قابل پرداخت باید مثبت باشد').optional(),
      paymentMethod: yup.string().optional(),
      shippingAddress: yup.string().trim().required('آدرس الزامی است'),
});

export const updateOrderSchema = yup.object({
      user: yup.string().optional(),
      items: yup
            .array()
            .of(
                  yup.object({
                        product: yup.string().required('شناسه محصول الزامی است'),
                        quantity: yup.number().positive('تعداد باید مثبت باشد').required('تعداد الزامی است'),
                        price: yup.number().positive('قیمت باید مثبت باشد').required('قیمت الزامی است'),
                  })
            )
            .min(1, 'حداقل یک محصول باید در سفارش باشد')
            .optional(),
      status: yup.string().oneOf(Object.values(OrderStatus)).optional(),
      totalPrice: yup.number().positive('مجموع قیمت باید مثبت باشد').optional(),
      discountCode: yup.string().optional(),
      discountAmount: yup.number().min(0, 'مبلغ تخفیف نمی‌تواند منفی باشد').optional(),
      payablePrice: yup.number().positive('قیمت قابل پرداخت باید مثبت باشد').optional(),
      paymentMethod: yup.string().optional(),
      shippingAddress: yup.string().optional(),
});

export const updateOrderStatusSchema = yup.object({
      status: yup.string().oneOf(Object.values(OrderStatus)).required('وضعیت سفارش الزامی است'),
});
