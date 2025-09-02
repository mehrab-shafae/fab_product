// import { Types } from 'mongoose';
import { OrderModel } from '../models/order.model.js';
import { IOrder, OrderStatus } from '../types/order.types.js';
import { InventoryReservation } from '../models/inventoryReservation.model.js';
import { Product } from '../../products/models/product.model.js';

export class OrderService {
      /**
       * بررسی موجودی و قیمت محصول
       */
      private async validateProductAndVariant(productId: string, variantId: string, quantity: number): Promise<{
            product: any;
            variant: any;
            availableStock: number;
            price: number;
      }> {
            const product = await Product.findById(productId);
            if (!product) throw new Error('محصول یافت نشد');
            if (product.status !== 'active') throw new Error('محصول غیرفعال است');

            const variant = (product.variants || []).find((v: any) => v._id?.toString() === variantId);
            if (!variant) throw new Error('ویراینت محصول یافت نشد');

            const currentStock = variant.inventory?.stock || 0;
            const price = variant.inventory?.price || 0;

            if (price <= 0) throw new Error('قیمت محصول نامعتبر است');

            // بررسی موجودی رزرو شده
            const invRes = await InventoryReservation.findOne({ productId: product._id, variantId: variant._id });
            const reservedStock = invRes?.reservedStock || 0;
            const availableStock = currentStock - reservedStock;

            if (availableStock < quantity) {
                  throw new Error(`موجودی کافی نیست. موجودی موجود: ${availableStock}, درخواستی: ${quantity}`);
            }

            return { product, variant, availableStock, price };
      }

      /**
       * رزرو موجودی
       */
      private async reserveInventory(productId: string, variantId: string, quantity: number, orderId: string): Promise<void> {
            let invRes = await InventoryReservation.findOne({ productId, variantId });
            
            if (!invRes) {
                  const product = await Product.findById(productId);
                  const variant = (product.variants || []).find((v: any) => v._id?.toString() === variantId);
                  
                  invRes = new InventoryReservation({
                        productId,
                        variantId,
                        totalStock: variant.inventory?.stock || 0,
                        reservedStock: 0,
                        reservationHistory: [],
                  });
            }

            // بررسی مجدد موجودی
            const availableStock = invRes.totalStock - invRes.reservedStock;
            if (availableStock < quantity) {
                  throw new Error(`موجودی رزرو کافی نیست. موجودی موجود: ${availableStock}, درخواستی: ${quantity}`);
            }

            // افزایش موجودی رزرو شده
            invRes.reservedStock += quantity;
            
            // اضافه کردن به تاریخچه رزرو
            invRes.reservationHistory.push({
                  orderId,
                  quantity,
                  reservedAt: new Date(),
                  expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 دقیقه
                  status: 'active',
            });

            await invRes.save();
      }

      /**
       * ایجاد سفارش جدید
       */
      async createOrder(orderData: Partial<IOrder>): Promise<IOrder> {
            try {
                  if (!orderData.items || orderData.items.length === 0) {
                        throw new Error('سفارش باید حداقل یک آیتم داشته باشد');
                  }

                  if (!orderData.shippingAddress || String(orderData.shippingAddress).trim() === '') {
                        throw new Error('آدرس تحویل الزامی است');
                  }

                  // بررسی و اعتبارسنجی تمام محصولات
                  const validatedItems = [];
                  let totalPrice = 0;

                  for (const item of orderData.items) {
                        if (!item.variantId) {
                              throw new Error('شناسه ویراینت برای تمام آیتم‌ها الزامی است');
                        }

                        const validation = await this.validateProductAndVariant(
                              item.product.toString(),
                              item.variantId.toString(),
                              item.quantity
                        );

                        const itemPrice = validation.price * item.quantity;
                        totalPrice += itemPrice;

                        validatedItems.push({
                              product: item.product,
                              variantId: item.variantId,
                              quantity: item.quantity,
                              price: validation.price, // استفاده از قیمت به‌روز شده
                        });
                  }

                  // محاسبه قیمت قابل پرداخت (بدون تخفیف)
                  const payablePrice = totalPrice;

                  // ایجاد سفارش
                  const order = new OrderModel({
                        user: orderData.user,
                        items: validatedItems,
                        totalPrice,
                        payablePrice,
                        discountAmount: 0,
                        paymentMethod: orderData.paymentMethod,
                        shippingAddress: orderData.shippingAddress,
                        status: OrderStatus.RESERVING, // ابتدا در حال رزرو
                  });

                  const savedOrder = await order.save();

                  // رزرو موجودی برای تمام آیتم‌ها
                  for (const item of validatedItems) {
                        await this.reserveInventory(
                              item.product.toString(),
                              item.variantId.toString(),
                              item.quantity,
                              savedOrder._id.toString()
                        );
                  }

                  // تغییر وضعیت به رزرو شده
                  savedOrder.status = OrderStatus.RESERVED;
                  await savedOrder.save();

                  return savedOrder.populate([
                        { path: 'items.product', select: 'name img' },
                  ]);
            } catch (error) {
                  throw new Error(`خطا در ایجاد سفارش: ${(error as Error).message}`);
            }
      }

      /**
       * دریافت تمام سفارشات
       */
      async getAllOrders(page: number = 1, limit: number = 10, status?: OrderStatus): Promise<{ orders: IOrder[]; total: number }> {
            try {
                  const filter: any = {};
                  if (status) {
                        filter.status = status;
                  }

                  const skip = (page - 1) * limit;

                  const [orders, total] = await Promise.all([OrderModel.find(filter).populate('user', 'name email').populate('items.product', 'name price images').sort({ createdAt: -1 }).skip(skip).limit(limit), OrderModel.countDocuments(filter)]);

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
                  return await OrderModel.findById(orderId).populate('user', 'name email phone').populate('items.product', 'name price images description');
            } catch (error) {
                  throw new Error(`خطا در دریافت سفارش: ${(error as Error).message}`);
            }
      }

      /**
       * دریافت سفارشات کاربر
       */
      async getOrdersByUser(userId: string, page: number = 1, limit: number = 10): Promise<{ orders: IOrder[]; total: number }> {
            try {
                  const skip = (page - 1) * limit;

                  const [orders, total] = await Promise.all([OrderModel.find({ user: userId }).populate('items.product', 'name price images').sort({ createdAt: -1 }).skip(skip).limit(limit), OrderModel.countDocuments({ user: userId })]);

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
                  return await OrderModel.findByIdAndUpdate(orderId, { status }, { new: true }).populate([
                        { path: 'user', select: 'name email' },
                        { path: 'items.product', select: 'name price' },
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
                        updateData.totalPrice = updateData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                  }

                  return await OrderModel.findByIdAndUpdate(orderId, updateData, { new: true, runValidators: true }).populate([
                        { path: 'user', select: 'name email' },
                        { path: 'items.product', select: 'name price images' },
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
                                    totalRevenue: { $sum: '$totalPrice' },
                              },
                        },
                  ]);

                  const statusStats = await OrderModel.aggregate([
                        {
                              $group: {
                                    _id: '$status',
                                    count: { $sum: 1 },
                              },
                        },
                  ]);

                  const result = {
                        total: stats[0]?.total || 0,
                        totalRevenue: stats[0]?.totalRevenue || 0,
                        pending: 0,
                        paid: 0,
                        shipped: 0,
                        delivered: 0,
                        canceled: 0,
                  };

                  statusStats.forEach((stat: any) => {
                        if (stat._id in result) {
                              result[stat._id as keyof typeof result] = stat.count;
                        }
                  });

                  return result;
            } catch (error) {
                  throw new Error(`خطا در دریافت آمار سفارشات: ${(error as Error).message}`);
            }
      }

      /**
       * منقضی کردن رزروهای قدیمی
       * این تابع باید به صورت دوره‌ای (مثلاً هر ۵ دقیقه) اجرا شود
       */
      async expireReservationJob(): Promise<{ expiredOrders: number; expiredReservations: number }> {
            const now = new Date();
            let expiredOrders = 0;
            let expiredReservationsCount = 0;

            try {
                  // پیدا کردن رزروهایی که منقضی شده‌اند و هنوز finalized یا expired نشده‌اند
                  const expiredReservations = await InventoryReservation.find({
                        'reservationHistory.status': 'active',
                        'reservationHistory.expiresAt': { $lte: now },
                  });

                  for (const invRes of expiredReservations) {
                        let changed = false;
                        const orderIdsToExpire = new Set<string>();

                        for (const rh of invRes.reservationHistory) {
                              if (rh.status === 'active' && rh.expiresAt <= now) {
                                    rh.status = 'expired';
                                    invRes.reservedStock -= rh.quantity;
                                    changed = true;
                                    expiredReservationsCount++;

                                    // جمع‌آوری شناسه‌های سفارش‌های منقضی شده
                                    if (rh.orderId) {
                                          orderIdsToExpire.add(rh.orderId.toString());
                                    }
                              }
                        }

                        if (changed) {
                              await invRes.save();
                        }

                        // تغییر وضعیت سفارش‌های منقضی شده
                        for (const orderId of orderIdsToExpire) {
                              const order = await OrderModel.findById(orderId);
                              if (order && order.status === OrderStatus.RESERVED) {
                                    order.status = OrderStatus.EXPIRED;
                                    await order.save();
                                    expiredOrders++;
                              }
                        }
                  }

                  return { expiredOrders, expiredReservations: expiredReservationsCount };
            } catch (error) {
                  console.error('خطا در منقضی کردن رزروها:', error);
                  return { expiredOrders, expiredReservations: expiredReservationsCount };
            }
      }

    /**
     * نهایی کردن پرداخت سفارش
     */
    async finalizeOrderPayment(orderId: string): Promise<void> {
        const order = await OrderModel.findById(orderId);
        if (!order) throw new Error('سفارش یافت نشد');
        
        if (order.status !== OrderStatus.RESERVED) {
            throw new Error('سفارش در وضعیت رزرو نیست. وضعیت فعلی: ' + order.status);
        }

        // بررسی مجدد موجودی قبل از نهایی کردن
        for (const item of order.items) {
            const validation = await this.validateProductAndVariant(
                item.product.toString(),
                item.variantId.toString(),
                item.quantity
            );
        }

        // نهایی کردن پرداخت و کاهش موجودی
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (!product) throw new Error('محصول یافت نشد');
            
            const variant = (product.variants || []).find((v: any) => v._id?.toString() === (item.variantId?.toString() || ''));
            if (!variant) throw new Error('ویراینت محصول یافت نشد');
            
            // کاهش موجودی اصلی محصول
            if (!variant.inventory) {
                variant.inventory = { stock: 0, price: 0 };
            }
            
            if ((variant.inventory.stock || 0) < item.quantity) {
                throw new Error(`موجودی کافی نیست. موجودی: ${variant.inventory.stock}, درخواستی: ${item.quantity}`);
            }
            
            variant.inventory.stock = (variant.inventory.stock || 0) - item.quantity;
            await product.save();

            // نهایی کردن رزرو
            const invRes = await InventoryReservation.findOne({ 
                productId: product._id, 
                variantId: variant._id 
            });
            
            if (invRes) {
                // به‌روزرسانی وضعیت رزرو
                await InventoryReservation.updateOne(
                    { 
                        productId: product._id, 
                        variantId: variant._id, 
                        'reservationHistory.orderId': order._id, 
                        'reservationHistory.status': 'active' 
                    },
                    {
                        $set: {
                            'reservationHistory.$.status': 'finalized',
                        },
                        $inc: {
                            reservedStock: -item.quantity,
                        },
                    }
                );
            }
        }

        // تغییر وضعیت سفارش
        order.status = OrderStatus.PAID;
        await order.save();
    }

      /**
       * لغو سفارش و آزاد کردن موجودی رزرو شده
       */
      async cancelOrder(orderId: string): Promise<IOrder | null> {
            const order = await OrderModel.findById(orderId);
            if (!order) throw new Error('سفارش یافت نشد');

            if (order.status !== OrderStatus.RESERVED) {
                  throw new Error('فقط سفارش‌های رزرو شده قابل لغو هستند');
            }

            // آزاد کردن موجودی رزرو شده
            for (const item of order.items) {
                  const invRes = await InventoryReservation.findOne({
                        productId: item.product,
                        variantId: item.variantId,
                  });

                  if (invRes) {
                        // به‌روزرسانی وضعیت رزرو
                        await InventoryReservation.updateOne(
                              {
                                    productId: item.product,
                                    variantId: item.variantId,
                                    'reservationHistory.orderId': order._id,
                                    'reservationHistory.status': 'active',
                              },
                              {
                                    $set: {
                                          'reservationHistory.$.status': 'canceled',
                                    },
                                    $inc: {
                                          reservedStock: -item.quantity,
                                    },
                              }
                        );
                  }
            }

            // تغییر وضعیت سفارش
            order.status = OrderStatus.CANCELED;
            return await order.save();
      }

      /**
       * دریافت آمار موجودی
       */
      async getInventoryStats(): Promise<{
            totalProducts: number;
            lowStockProducts: number;
            outOfStockProducts: number;
            reservedStock: number;
      }> {
            try {
                  const products = await Product.find({ status: 'active' });
                  let lowStockProducts = 0;
                  let outOfStockProducts = 0;
                  let totalReservedStock = 0;

                  for (const product of products) {
                        for (const variant of product.variants || []) {
                              const currentStock = variant.inventory?.stock || 0;
                              
                              if (currentStock === 0) {
                                    outOfStockProducts++;
                              } else if (currentStock <= 5) {
                                    lowStockProducts++;
                              }

                              // محاسبه موجودی رزرو شده
                              const invRes = await InventoryReservation.findOne({
                                    productId: product._id,
                                    variantId: variant._id,
                              });
                              
                              if (invRes) {
                                    totalReservedStock += invRes.reservedStock;
                              }
                        }
                  }

                  return {
                        totalProducts: products.length,
                        lowStockProducts,
                        outOfStockProducts,
                        reservedStock: totalReservedStock,
                  };
            } catch (error) {
                  throw new Error(`خطا در دریافت آمار موجودی: ${(error as Error).message}`);
            }
      }
}

export const orderService = new OrderService();
