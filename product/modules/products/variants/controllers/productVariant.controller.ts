import { Request, Response } from 'express';
import { createProductVariant, getProductVariants, deleteProductVariant } from '../services/productVariant.service.js';

/**
 * @deprecated
 */
export const createProductVariantController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const variant = await createProductVariant(data);
            res.status(201).json({ status: 'success', data: variant, message: 'Product variant created successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

/**
 * @deprecated
 */
export const getProductVariantsController = async (req: Request, res: Response) => {
      try {
            const variants = await getProductVariants(req.params.productId);
            res.json({ status: 'success', data: variants });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

/**
 * @deprecated
 */
export const deleteProductVariantController = async (req: Request, res: Response) => {
      try {
            const variant = await deleteProductVariant(req.params.variantId);
            if (!variant) return res.status(404).json({ status: 'error', error: 'Variant not found' });
            res.json({ status: 'success', data: variant, message: 'Product variant deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
