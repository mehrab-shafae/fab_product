import { Product } from '../../../products/models/product.model.js';
import mongoose from 'mongoose';

export interface ProductValidationResult {
    isValid: boolean;
    validProductIds: string[];
    invalidProductIds: string[];
    validSkus: string[];
    invalidSkus: string[];
    errors: string[];
}

export class ProductValidationService {
    /**
     * Validates product IDs and SKUs for discount creation
     * @param productIds - Array of product IDs or SKUs to validate
     * @returns Validation result with valid/invalid items
     */
    async validateProducts(productIds: string[]): Promise<ProductValidationResult> {
        const result: ProductValidationResult = {
            isValid: true,
            validProductIds: [],
            invalidProductIds: [],
            validSkus: [],
            invalidSkus: [],
            errors: []
        };

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return result;
        }

        // Separate product IDs from SKUs
        const { productObjectIds, skus } = this.separateIdsAndSkus(productIds);

        // Validate product IDs
        if (productObjectIds.length > 0) {
            await this.validateProductIds(productObjectIds, result);
        }

        // Validate SKUs
        if (skus.length > 0) {
            await this.validateSkus(skus, result);
        }

        // Set overall validity
        result.isValid = result.invalidProductIds.length === 0 && result.invalidSkus.length === 0;

        return result;
    }

    /**
     * Separates valid MongoDB ObjectIds from SKUs
     */
    private separateIdsAndSkus(items: string[]): { productObjectIds: string[]; skus: string[] } {
        const productObjectIds: string[] = [];
        const skus: string[] = [];

        for (const item of items) {
            if (mongoose.Types.ObjectId.isValid(item)) {
                productObjectIds.push(item);
            } else {
                skus.push(item);
            }
        }

        return { productObjectIds, skus };
    }

    /**
     * Validates product IDs by checking if they exist and are active
     */
    private async validateProductIds(productIds: string[], result: ProductValidationResult): Promise<void> {
        try {
            const products = await Product.find({
                _id: { $in: productIds },
                status: 'active',
                deleted_at: null
            }).select('_id');

            const foundProductIds = products.map((p: any) => p._id.toString());
            const notFoundProductIds = productIds.filter(id => !foundProductIds.includes(id));

            result.validProductIds.push(...foundProductIds);
            result.invalidProductIds.push(...notFoundProductIds);

            // Add error messages for invalid product IDs
            for (const invalidId of notFoundProductIds) {
                result.errors.push(`محصول با شناسه ${invalidId} پیدا نشد یا غیرفعال است`);
            }
        } catch (error) {
            result.errors.push('خطا در بررسی شناسه محصولات');
            result.invalidProductIds.push(...productIds);
        }
    }

    /**
     * Validates SKUs by checking if they exist in active products
     */
    private async validateSkus(skus: string[], result: ProductValidationResult): Promise<void> {
        try {
            const products = await Product.find({
                'variants.sku': { $in: skus },
                status: 'active',
                deleted_at: null
            }).select('variants.sku');

            const foundSkus: string[] = [];
            products.forEach(product => {
                product.variants?.forEach(variant => {
                    if (variant.sku && skus.includes(variant.sku)) {
                        foundSkus.push(variant.sku);
                    }
                });
            });

            const notFoundSkus = skus.filter(sku => !foundSkus.includes(sku));

            result.validSkus.push(...foundSkus);
            result.invalidSkus.push(...notFoundSkus);

            // Add error messages for invalid SKUs
            for (const invalidSku of notFoundSkus) {
                result.errors.push(`محصول با کد SKU ${invalidSku} پیدا نشد یا غیرفعال است`);
            }
        } catch (error) {
            result.errors.push('خطا در بررسی کدهای SKU');
            result.invalidSkus.push(...skus);
        }
    }

    /**
     * Gets all valid product IDs from a mixed array of IDs and SKUs
     * This method returns the actual product IDs for both direct IDs and SKUs
     */
    async getValidProductIds(productIds: string[]): Promise<string[]> {
        const validation = await this.validateProducts(productIds);
        
        // Get product IDs for SKUs
        const skuProductIds: string[] = [];
        if (validation.validSkus.length > 0) {
            const products = await Product.find({
                'variants.sku': { $in: validation.validSkus },
                status: 'active',
                deleted_at: null
            }).select('_id variants.sku');

            const skuToProductIdMap = new Map<string, string>();
            products.forEach((product: any) => {
                product.variants?.forEach((variant: any) => {
                    if (variant.sku && validation.validSkus.includes(variant.sku)) {
                        skuToProductIdMap.set(variant.sku, product._id.toString());
                    }
                });
            });

            skuProductIds.push(...Array.from(skuToProductIdMap.values()));
        }

        // Combine direct product IDs with SKU-derived product IDs
        return [...validation.validProductIds, ...skuProductIds];
    }
}

export const productValidationService = new ProductValidationService();
