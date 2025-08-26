import { DiscountModel, IDiscount } from '../models/discount.model.js';

export class DiscountsService {
      async create(discountData: Omit<IDiscount, '_id' | 'createdAt' | 'updatedAt'>): Promise<IDiscount> {
            const discount = new DiscountModel(discountData);
            return discount.save();
      }

      async bulkCreate(discounts: Array<Omit<IDiscount, '_id' | 'createdAt' | 'updatedAt'>>): Promise<IDiscount[]> {
            return DiscountModel.insertMany(discounts);
      }

      async list(): Promise<IDiscount[]> {
            return DiscountModel.find();
      }

      async getById(id: string): Promise<IDiscount | null> {
            return DiscountModel.findById(id);
      }

      async getByCode(code: string): Promise<IDiscount | null> {
            return DiscountModel.findOne({ code });
      }

      async update(id: string, update: Partial<IDiscount>): Promise<IDiscount | null> {
            return DiscountModel.findByIdAndUpdate(id, update, { new: true });
      }

      async remove(id: string): Promise<IDiscount | null> {
            return DiscountModel.findByIdAndDelete(id);
      }

      async statusByCode(code: string): Promise<{ discount: IDiscount; status: string } | null> {
            const discount = await DiscountModel.findOne({ code });
            if (!discount) return null;
            let statusMsg = 'کد معتبر است';
            if (!discount.active) statusMsg = 'کد غیرفعال است';
            else if (discount.expiry < new Date()) statusMsg = 'کد تخفیف منقضی شده است';
            else if (discount.usedCount >= discount.maxUsage) statusMsg = 'تعداد استفاده تمام شده است';
            return { discount, status: statusMsg };
      }

      async apply(code: string, userId?: string, productIds?: string[]): Promise<{
            code: string;
            type: IDiscount['type'];
            value: number;
            appliedProducts?: string[];
      }> {
            const discount = await DiscountModel.findOne({ code });
            if (!discount) throw new Error('کد تخفیف پیدا نشد');
            if (!discount.active) throw new Error('کد غیرفعال است');
            if (discount.expiry < new Date()) throw new Error('کد تخفیف منقضی شده است');
            if (discount.usedCount >= discount.maxUsage) throw new Error('تعداد استفاده تمام شده است');
            if (discount.userIds.length && (!userId || !discount.userIds.includes(userId))) throw new Error('کد تخفیف برای این کاربر مجاز نیست');
            if (discount.productIds.length && (!productIds || !productIds.some(pid => discount.productIds.includes(pid)))) throw new Error('کد تخفیف برای این محصولات مجاز نیست');

            const appliedProducts = productIds && discount.productIds.length ? productIds.filter(pid => discount.productIds.includes(pid)) : productIds;

            discount.usedCount += 1;
            await discount.save();

            return { code: discount.code, type: discount.type, value: discount.value, appliedProducts };
      }
}

export const discountsService = new DiscountsService();


