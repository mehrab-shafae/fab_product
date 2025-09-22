import { DiscountModel, IDiscount, ProductMode, UserMode } from '../models/discount.model.js';
import { productValidationService } from './productValidation.service.js';

export class DiscountsService {
      /**
       * Generates a unique discount code
       */
      private async generateUniqueCode(): Promise<string> {
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                  const code = this.generateRandomCode();
                  const exists = await DiscountModel.findOne({ code });
                  if (!exists) {
                        return code;
                  }
                  attempts++;
            }
            
            throw new Error('نمی‌توان کد تخفیف منحصر به فرد تولید کرد');
      }

      /**
       * Generates a random discount code (letters + numbers)
       */
      private generateRandomCode(): string {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            let code = '';
            
            // Add 3-4 random letters
            for (let i = 0; i < 4; i++) {
                  code += letters.charAt(Math.floor(Math.random() * letters.length));
            }
            
            // Add 3-4 random numbers
            for (let i = 0; i < 4; i++) {
                  code += numbers.charAt(Math.floor(Math.random() * numbers.length));
            }
            
            return code;
      }

      /**
       * Validates discount data and sets defaults
       */
      private async validateAndSetDefaults(discountData: any): Promise<any> {
            // Generate code if not provided
            if (!discountData.code) {
                  discountData.code = await this.generateUniqueCode();
            }

            // Set default product mode
            if (!discountData.productMode) {
                  discountData.productMode = discountData.productIds && discountData.productIds.length > 0 ? 'specific' : 'all';
            }

            // Set default user mode
            if (!discountData.userMode) {
                  discountData.userMode = discountData.userIds && discountData.userIds.length > 0 ? 'specific' : 'all';
            }

            // Initialize usage records
            if (!discountData.usageRecords) {
                  discountData.usageRecords = [];
            }

            return discountData;
      }

      async create(discountData: Omit<IDiscount, '_id' | 'createdAt' | 'updatedAt'>): Promise<IDiscount> {
            // Validate and set defaults
            const validatedData = await this.validateAndSetDefaults(discountData);

            // Validate product IDs and SKUs if in specific mode
            if (validatedData.productMode === 'specific' && validatedData.productIds && validatedData.productIds.length > 0) {
                  const validation = await productValidationService.validateProducts(validatedData.productIds);
                  
                  if (!validation.isValid) {
                        throw new Error(`محصولات نامعتبر: ${validation.errors.join(', ')}`);
                  }

                  // Get actual product IDs for both direct IDs and SKUs
                  const validProductIds = await productValidationService.getValidProductIds(validatedData.productIds);
                  validatedData.productIds = validProductIds;
            } else if (validatedData.productMode === 'all') {
                  // Clear productIds for all products mode
                  validatedData.productIds = [];
            }

            const discount = new DiscountModel(validatedData);
            return discount.save();
      }

      async bulkCreate(discounts: Array<Omit<IDiscount, '_id' | 'createdAt' | 'updatedAt'>>): Promise<IDiscount[]> {
            // Validate and set defaults for all discounts
            const validatedDiscounts = [];
            for (const discountData of discounts) {
                  const validatedData = await this.validateAndSetDefaults(discountData);
                  
                  // Validate product IDs and SKUs if in specific mode
                  if (validatedData.productMode === 'specific' && validatedData.productIds && validatedData.productIds.length > 0) {
                        const validation = await productValidationService.validateProducts(validatedData.productIds);
                        
                        if (!validation.isValid) {
                              throw new Error(`محصولات نامعتبر در تخفیف ${validatedData.code || 'نامشخص'}: ${validation.errors.join(', ')}`);
                        }

                        // Get actual product IDs for both direct IDs and SKUs
                        const validProductIds = await productValidationService.getValidProductIds(validatedData.productIds);
                        validatedData.productIds = validProductIds;
                  } else if (validatedData.productMode === 'all') {
                        // Clear productIds for all products mode
                        validatedData.productIds = [];
                  }
                  
                  validatedDiscounts.push(validatedData);
            }

            return DiscountModel.insertMany(validatedDiscounts) as Promise<IDiscount[]>;
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

      async apply(
            code: string,
            userId?: string,
            productIds?: string[],
            orderId?: string
      ): Promise<{
            code: string;
            type: IDiscount['type'];
            value: number;
            appliedProducts?: string[];
            usageRecord?: any;
      }> {
            const discount = await DiscountModel.findOne({ code });
            if (!discount) throw new Error('کد تخفیف پیدا نشد');
            if (!discount.active) throw new Error('کد غیرفعال است');
            if (discount.expiry < new Date()) throw new Error('کد تخفیف منقضی شده است');
            if (discount.usedCount >= discount.maxUsage) throw new Error('تعداد استفاده تمام شده است');

            // Check user restrictions
            if (discount.userMode === 'specific' && (!userId || !discount.userIds.includes(userId))) {
                  throw new Error('کد تخفیف برای این کاربر مجاز نیست');
            }

            // Check if user already used this discount (for one_per_user mode)
            if (discount.userMode === 'one_per_user' && userId) {
                  const userUsed = discount.usageRecords.some(record => record.userId === userId);
                  if (userUsed) {
                        throw new Error('شما قبلاً از این کد تخفیف استفاده کرده‌اید');
                  }
            }

            // Determine applicable products
            let appliedProducts: string[] = [];
            if (discount.productMode === 'specific') {
                  if (!productIds || productIds.length === 0) {
                        throw new Error('کد تخفیف فقط برای محصولات مشخص شده قابل استفاده است');
                  }
                  appliedProducts = productIds.filter(pid => discount.productIds.includes(pid));
                  if (appliedProducts.length === 0) {
                        throw new Error('کد تخفیف برای این محصولات مجاز نیست');
                  }
            } else {
                  // All products mode
                  appliedProducts = productIds || [];
            }

            // Create usage records for each applied product
            const newUsageRecords = appliedProducts.map(productId => ({
                  userId: userId || 'anonymous',
                  productId,
                  usedAt: new Date(),
                  orderId
            }));

            // Update discount
            discount.usedCount += appliedProducts.length;
            discount.usageRecords.push(...newUsageRecords);
            await discount.save();

            return { 
                  code: discount.code, 
                  type: discount.type, 
                  value: discount.value, 
                  appliedProducts,
                  usageRecord: newUsageRecords
            };
      }

      /**
       * Get detailed status and statistics for a discount
       */
      async getDetailedStatus(code: string): Promise<{
            discount: IDiscount;
            status: string;
            statistics: {
                  totalUsage: number;
                  remainingUsage: number;
                  uniqueUsers: number;
                  uniqueProducts: number;
                  usageByUser: Record<string, number>;
                  usageByProduct: Record<string, number>;
            };
      }> {
            const discount = await DiscountModel.findOne({ code });
            if (!discount) throw new Error('کد تخفیف پیدا نشد');

            let statusMsg = 'کد معتبر است';
            if (!discount.active) statusMsg = 'کد غیرفعال است';
            else if (discount.expiry < new Date()) statusMsg = 'کد تخفیف منقضی شده است';
            else if (discount.usedCount >= discount.maxUsage) statusMsg = 'تعداد استفاده تمام شده است';

            // Calculate statistics
            const uniqueUsers = new Set(discount.usageRecords.map(r => r.userId)).size;
            const uniqueProducts = new Set(discount.usageRecords.map(r => r.productId)).size;
            
            const usageByUser: Record<string, number> = {};
            const usageByProduct: Record<string, number> = {};
            
            discount.usageRecords.forEach(record => {
                  usageByUser[record.userId] = (usageByUser[record.userId] || 0) + 1;
                  usageByProduct[record.productId] = (usageByProduct[record.productId] || 0) + 1;
            });

            return {
                  discount,
                  status: statusMsg,
                  statistics: {
                        totalUsage: discount.usedCount,
                        remainingUsage: Math.max(0, discount.maxUsage - discount.usedCount),
                        uniqueUsers,
                        uniqueProducts,
                        usageByUser,
                        usageByProduct
                  }
            };
      }

      /**
       * Get usage history for a discount
       */
      async getUsageHistory(code: string, page: number = 1, limit: number = 10): Promise<{
            usageRecords: any[];
            pagination: {
                  total: number;
                  page: number;
                  limit: number;
                  pages: number;
            };
      }> {
            const discount = await DiscountModel.findOne({ code });
            if (!discount) throw new Error('کد تخفیف پیدا نشد');

            const skip = (page - 1) * limit;
            const usageRecords = discount.usageRecords
                  .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
                  .slice(skip, skip + limit);

            return {
                  usageRecords,
                  pagination: {
                        total: discount.usageRecords.length,
                        page,
                        limit,
                        pages: Math.ceil(discount.usageRecords.length / limit)
                  }
            };
      }

      /**
       * Update discount status (active/inactive)
       */
      async updateStatus(id: string, active: boolean): Promise<IDiscount | null> {
            return DiscountModel.findByIdAndUpdate(id, { active }, { new: true });
      }

      /**
       * Get all discounts with filtering and pagination
       */
      async getDiscountsWithFilters(filters: {
            active?: boolean;
            productMode?: ProductMode;
            userMode?: UserMode;
            type?: string;
            page?: number;
            limit?: number;
      } = {}): Promise<{
            discounts: IDiscount[];
            pagination: {
                  total: number;
                  page: number;
                  limit: number;
                  pages: number;
            };
      }> {
            const { active, productMode, userMode, type, page = 1, limit = 10 } = filters;
            const query: any = {};

            if (active !== undefined) query.active = active;
            if (productMode) query.productMode = productMode;
            if (userMode) query.userMode = userMode;
            if (type) query.type = type;

            const skip = (page - 1) * limit;
            const [discounts, total] = await Promise.all([
                  DiscountModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
                  DiscountModel.countDocuments(query)
            ]);

            return {
                  discounts,
                  pagination: {
                        total,
                        page,
                        limit,
                        pages: Math.ceil(total / limit)
                  }
            };
      }
}

export const discountsService = new DiscountsService();
