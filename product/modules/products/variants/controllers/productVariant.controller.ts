import { Request, Response } from 'express';
import { createProductVariant, getProductVariants, deleteProductVariant } from '../services/productVariant.service';

export const createProductVariantController = async (req: Request, res: Response) => {
  try {
    const data = { ...req.body, product_id: req.params.productId };
    const variant = await createProductVariant(data);
    res.status(201).json({ success: true, data: variant, message: 'Product variant created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getProductVariantsController = async (req: Request, res: Response) => {
  try {
    const variants = await getProductVariants(req.params.productId);
    res.json({ success: true, data: variants });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteProductVariantController = async (req: Request, res: Response) => {
  try {
    const variant = await deleteProductVariant(req.params.variantId);
    if (!variant) return res.status(404).json({ success: false, error: 'Variant not found' });
    res.json({ success: true, data: variant, message: 'Product variant deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}; 