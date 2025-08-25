// import { Types } from 'mongoose';
import { OrderModel } from '../models/order.model.js';
import { IOrder, OrderStatus } from '../types/order.types.js';

export class OrderService {
  /**
   * ایجاد سفارش جدید
   */
  async createOrder(orderData: Partial<IOrder>): Promise<IOrder> {
    try {
      // محاسبه قیمت کل و قیمت قابل پرداخت
      const totalPrice = orderData.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
      const discountAmount = orderData.discountAmount || 0;
      const payablePrice = Math.max(0, totalPrice - discountAmount);
      
      const order = new OrderModel({
        ...orderData,
        totalPrice,
        discountCode: orderData.discountCode,
        discountAmount,
        payablePrice,
        status: OrderStatus.PENDING
      });
      
      const savedOrder = await order.save();
      return savedOrder.populate([
        // { path: 'user', select: 'name email phone' },
        { path: 'items.product', select: 'name price img' }
      ]);
    } catch (error) {
      throw new Error(`خطا در ایجاد سفارش: ${(error as Error).message}`);
    }
  }

  /**
   * دریافت تمام سفارشات
   */
  async getAllOrders(page: number = 1, limit: number = 10, status?: OrderStatus): Promise<{ orders: IOrder[], total: number }> {
    try {
      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const skip = (page - 1) * limit;
      
      const [orders, total] = await Promise.all([
        OrderModel.find(filter)
          .populate('user', 'name email')
          .populate('items.product', 'name price images')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        OrderModel.countDocuments(filter)
      ]);

      return { orders, total };
    } catch (error) {
      throw new Error(`خطا در دریافت سفارشات: ${(error as Error).message}`);
    }
  }

  /**
   * دریافت سفارش بر اساس شناسه
   */
  async getOrderById(orderId: string): Promise<IOrder | null> {
    try {
      return await OrderModel.findById(orderId)
        .populate('user', 'name email phone')
        .populate('items.product', 'name price images description');
    } catch (error) {
      throw new Error(`خطا در دریافت سفارش: ${(error as Error).message}`);
    }
  }

  /**
   * دریافت سفارشات کاربر
   */
  async getOrdersByUser(userId: string, page: number = 1, limit: number = 10): Promise<{ orders: IOrder[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [orders, total] = await Promise.all([
        OrderModel.find({ user: userId })
          .populate('items.product', 'name price images')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        OrderModel.countDocuments({ user: userId })
      ]);

      return { orders, total };
    } catch (error) {
      throw new Error(`خطا در دریافت سفارشات کاربر: ${(error as Error).message}`);
    }
  }

  /**
   * به‌روزرسانی وضعیت سفارش
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<IOrder | null> {
    try {
      return await OrderModel.findByIdAndUpdate(
        orderId,
        { status },
        { new: true }
      ).populate([
        { path: 'user', select: 'name email' },
        { path: 'items.product', select: 'name price' }
      ]);
    } catch (error) {
      throw new Error(`خطا در به‌روزرسانی وضعیت سفارش: ${(error as Error).message}`);
    }
  }

  /**
   * به‌روزرسانی سفارش
   */
  async updateOrder(orderId: string, updateData: Partial<IOrder>): Promise<IOrder | null> {
    try {
      // اگر آیتم‌ها تغییر کرده باشند، قیمت کل را دوباره محاسبه کن
      if (updateData.items) {
        updateData.totalPrice = updateData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      }

      return await OrderModel.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true, runValidators: true }
      ).populate([
        { path: 'user', select: 'name email' },
        { path: 'items.product', select: 'name price images' }
      ]);
    } catch (error) {
      throw new Error(`خطا در به‌روزرسانی سفارش: ${(error as Error).message}`);
    }
  }

  /**
   * حذف سفارش
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const result = await OrderModel.findByIdAndDelete(orderId);
      return !!result;
    } catch (error) {
      throw new Error(`خطا در حذف سفارش: ${(error as Error).message}`);
    }
  }

  /**
   * دریافت آمار سفارشات
   */
  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    paid: number;
    shipped: number;
    delivered: number;
    canceled: number;
    totalRevenue: number;
  }> {
    try {
      const stats = await OrderModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalRevenue: { $sum: '$totalPrice' }
          }
        }
      ]);

      const statusStats = await OrderModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        total: stats[0]?.total || 0,
        totalRevenue: stats[0]?.totalRevenue || 0,
        pending: 0,
        paid: 0,
        shipped: 0,
        delivered: 0,
        canceled: 0
      };

      statusStats.forEach(stat => {
        if (stat._id in result) {
          result[stat._id as keyof typeof result] = stat.count;
        }
      });

      return result;
    } catch (error) {
      throw new Error(`خطا در دریافت آمار سفارشات: ${(error as Error).message}`);
    }
  }
}

export const orderService = new OrderService();