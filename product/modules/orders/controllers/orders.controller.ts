import { Request, Response } from 'express';
import { orderService } from '../services/orders.service.js';
import { discountsService } from '../discounts/services/discounts.service.js';
import { OrderStatus } from '../types/order.types.js';

/**
 * ایجاد سفارش جدید
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
      try {
            const orderData = {
                  ...req.body,
            } as any;

            orderData.user = req.headers['user-id'] || 'ali';

            // اگر کد تخفیف وجود دارد، ابتدا آن را اعمال کن و مبلغ تخفیف را محاسبه کن
            if (orderData.discountCode) {
                  try {
                        const productIds = Array.isArray(orderData.items) ? orderData.items.map((it: any) => String(it.product)) : [];
                        const applied = await discountsService.apply(orderData.discountCode, String(orderData.user), productIds);

                        const totalEligibleAmount = (orderData.items || [])
                              .filter((it: any) => !applied.appliedProducts || applied.appliedProducts.includes(String(it.product)))
                              .reduce((sum: number, it: any) => sum + it.price * it.quantity, 0);

                        const discountAmount = applied.type === 'percentage' ? (totalEligibleAmount * applied.value) / 100 : Math.min(applied.value, totalEligibleAmount);

                        orderData.discountAmount = Math.max(0, Math.round(discountAmount));
                  } catch (e) {
                        return res.status(400).json({ status: 'error', message: (e as Error).message });
                  }
            }

            const order = await orderService.createOrder(orderData);

            res.status(201).json({
                  status: 'success',
                  message: 'سفارش با موفقیت ایجاد شد',
                  data: order,
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * دریافت تمام سفارشات
 */
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
      try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const status = req.query.status as OrderStatus;

            const result = await orderService.getAllOrders(page, limit, status);

            res.status(200).json({
                  status: 'success',
                  data: result.orders,
                  pagination: {
                        page,
                        limit,
                        total: result.total,
                        pages: Math.ceil(result.total / limit),
                  },
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * دریافت سفارش بر اساس شناسه
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
      try {
            const { id } = req.params;
            const order = await orderService.getOrderById(id);

            if (!order) {
                  res.status(404).json({
                        status: 'error',
                        message: 'سفارش مورد نظر یافت نشد',
                  });
                  return;
            }

            res.status(200).json({
                  status: 'success',
                  data: order,
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * دریافت سفارشات کاربر
 */
export const getOrdersByUser = async (req: Request, res: Response): Promise<void> => {
      try {
            //const userId = req.params.userId || req.user?.id;
            const userId = req.params.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            if (!userId) {
                  res.status(400).json({
                        status: 'error',
                        message: 'شناسه کاربر الزامی است',
                  });
                  return;
            }

            const result = await orderService.getOrdersByUser(userId, page, limit);

            res.status(200).json({
                  status: 'success',
                  data: result.orders,
                  pagination: {
                        page,
                        limit,
                        total: result.total,
                        pages: Math.ceil(result.total / limit),
                  },
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * به‌روزرسانی وضعیت سفارش
 */
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
      try {
            const { id } = req.params;
            const { status } = req.body;

            if (!Object.values(OrderStatus).includes(status)) {
                  res.status(400).json({
                        status: 'error',
                        message: 'وضعیت سفارش معتبر نیست',
                  });
                  return;
            }

            const order = await orderService.updateOrderStatus(id, status);

            if (!order) {
                  res.status(404).json({
                        status: 'error',
                        message: 'سفارش مورد نظر یافت نشد',
                  });
                  return;
            }

            res.status(200).json({
                  status: 'success',
                  message: 'وضعیت سفارش با موفقیت به‌روزرسانی شد',
                  data: order,
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * به‌روزرسانی سفارش
 */
export const updateOrder = async (req: Request, res: Response): Promise<void> => {
      try {
            const { id } = req.params;
            const updateData = req.body;

            const order = await orderService.updateOrder(id, updateData);

            if (!order) {
                  res.status(404).json({
                        status: 'error',
                        message: 'سفارش مورد نظر یافت نشد',
                  });
                  return;
            }

            res.status(200).json({
                  status: 'success',
                  message: 'سفارش با موفقیت به‌روزرسانی شد',
                  data: order,
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * حذف سفارش
 */
export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
      try {
            const { id } = req.params;
            const deleted = await orderService.deleteOrder(id);

            if (!deleted) {
                  res.status(404).json({
                        status: 'error',
                        message: 'سفارش مورد نظر یافت نشد',
                  });
                  return;
            }

            res.status(200).json({
                  status: 'success',
                  message: 'سفارش با موفقیت حذف شد',
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};

/**
 * دریافت آمار سفارشات
 */
export const getOrderStats = async (_: Request, res: Response): Promise<void> => {
      try {
            const stats = await orderService.getOrderStats();

            res.status(200).json({
                  status: 'success',
                  data: stats,
            });
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: (error as Error).message,
            });
      }
};
