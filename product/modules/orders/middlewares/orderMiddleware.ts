// hi

import { OrderModel } from '../models/order.model.js';
import { createOrderSchema, updateOrderSchema, updateOrderStatusSchema } from '../schema/order.schema.js';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';

export const validateCreateOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
            await createOrderSchema.validate(req.body);
            next();
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

// اعتبارسنجی yup برای ویرایش سفارش
export const validateUpdateOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
            await updateOrderSchema.validate(req.body);
            next();
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

// اعتبارسنجی yup برای تغییر وضعیت سفارش
export const validateUpdateOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
            await updateOrderStatusSchema.validate(req.body);
            next();
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

// چک وجود سفارش
export const checkOrderExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { id } = req.params;
      if (!id) {
            return next();
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ status: 'error', message: 'شناسه سفارش معتبر نیست.' });
            return;
      }
      const order = await OrderModel.findById(id);
      if (!order) {
            res.status(404).json({ status: 'error', message: 'سفارش مورد نظر یافت نشد.' });
            return;
      }
      next();
};

// چک وجود محصولات در سفارش
export const checkProductsExist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
            const { items } = req.body as any;
            if (!items || !Array.isArray(items)) {
                  res.status(400).json({ status: 'error', message: 'محصولات سفارش الزامی هستند.' });
                  return;
            }

            // Import Product model dynamically to avoid circular dependency
            const { Product } = await import('../../products/models/product.model.js');

            // Resolve SKUs to product + variant; compute price and totals server-side
            const skus = items.map((it: any) => String(it.sku));
            const products = await Product.find({ 'variants.sku': { $in: skus } }, { name: 1, img: 1, variants: 1, status: 1 }).lean();

            const skuToVariantInfo = new Map<string, { productId: string; price: number; stock: number; name: string }>();
            for (const p of products as any[]) {
                  if (!p || p.status !== 'active' || !Array.isArray(p.variants)) continue;
                  for (const v of p.variants) {
                        if (v && typeof v.sku === 'string' && v.sku) {
                              skuToVariantInfo.set(v.sku, {
                                    productId: String(p._id),
                                    price: Number(v?.inventory?.price || 0),
                                    stock: Number(v?.inventory?.stock ?? 0),
                                    name: p.name,
                              });
                        }
                  }
            }

            // Validate all requested SKUs exist and build normalized order items
            const normalizedItems: any[] = [];
            for (const item of items) {
                  const info = skuToVariantInfo.get(String(item.sku));
                  if (!info) {
                        res.status(404).json({ status: 'error', message: `SKU ${item.sku} یافت نشد یا محصول غیرفعال است.` });
                        return;
                  }
                  const quantity = Number(item.quantity || 0);
                  if (!(quantity > 0)) {
                        res.status(400).json({ status: 'error', message: `تعداد برای SKU ${item.sku} باید بیشتر از صفر باشد.` });
                        return;
                  }

                  // Stock availability check
                  if (info.stock < quantity) {
                        res.status(400).json({ status: 'error', message: `موجودی SKU ${item.sku} کافی نیست. موجودی: ${info.stock}` });
                        return;
                  }

                  normalizedItems.push({ product: info.productId, quantity, price: info.price });
            }

            // Compute totals server-side
            const calculatedTotal = normalizedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
            req.body.items = normalizedItems;
            req.body.totalPrice = calculatedTotal;
            const discountAmount = Number(req.body.discountAmount || 0);
            req.body.payablePrice = Math.max(0, calculatedTotal - discountAmount);

            // Optionally validate discount applicability later in controller/service
            next();
      } catch (error) {
            res.status(500).json({ status: 'error', message: 'خطا در بررسی محصولات.' });
      }
};

// چک وجود کاربر
// export const checkUserExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//   try {
//     const { user } = req.body;
//     if (!user) {
//       res.status(400).json({ status: 'error', message: 'شناسه کاربر الزامی است.' });
//       return;
//     }

//     if (!mongoose.Types.ObjectId.isValid(user)) {
//       res.status(400).json({ status: 'error', message: 'شناسه کاربر معتبر نیست.' });
//       return;
//     }

//     // Import User model dynamically to avoid circular dependency
//     const { User } = await import('../../users/models/user.model.js');

//     const userExists = await User.findById(user);
//     if (!userExists) {
//       res.status(404).json({ status: 'error', message: 'کاربر مورد نظر یافت نشد.' });
//       return;
//     }

//     next();
//   } catch (error) {
//     res.status(500).json({ status: 'error', message: 'خطا در بررسی کاربر.' });
//   }
// };

// محاسبه و اعتبارسنجی مجموع قیمت
export const validateTotalPrice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
            const { items, totalPrice } = req.body;

            if (!items || !Array.isArray(items)) {
                  res.status(400).json({ status: 'error', message: 'محصولات سفارش الزامی هستند.' });
                  return;
            }

            // محاسبه مجموع قیمت از محصولات
            const calculatedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

            if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
                  // Allow small floating point differences
                  res.status(400).json({
                        status: 'error',
                        message: `مجموع قیمت محاسبه شده (${calculatedTotal}) با مجموع قیمت ارسالی (${totalPrice}) مطابقت ندارد.`,
                  });
                  return;
            }

            next();
      } catch (error) {
            res.status(500).json({ status: 'error', message: 'خطا در محاسبه مجموع قیمت.' });
      }
};
