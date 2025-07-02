import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model.js';
import { searchProducts } from '../services/product.service.js';

export const createProduct = async (req: Request, res: Response) => {
      try {
            const product = new Product(req.body);
            await product.save();
            res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductById = async (req: Request, res: Response) => {
      try {
            const product = await Product.findById(req.params.id);
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
            res.json({ success: true, data: product });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const updateProduct = async (req: Request, res: Response) => {
      try {
            const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
            res.json({ success: true, data: product, message: 'Product updated successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const deleteProduct = async (req: Request, res: Response) => {
      try {
            const product = await Product.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
            res.json({ success: true, data: product, message: 'Product deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const searchProductsController = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      try {
            // تبدیل query string به پارامترهای مناسب
            const { page = 1, limit = 10, name, category_id, min_price, max_price, tags, sortField, sortOrder, ...rest } = req.query;
            // attributes را به صورت آبجکت دریافت کنیم (مثلاً attributes[brand]=X)
            let attributes: any = {};
            Object.keys(rest).forEach(key => {
                  if (key.startsWith('attributes[') && key.endsWith(']')) {
                        const attrKey = key.slice(11, -1);
                        attributes[attrKey] = rest[key];
                  }
            });
            const params = {
                  page,
                  limit,
                  name,
                  category_id,
                  min_price,
                  max_price,
                  tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
                  attributes,
                  sortField,
                  sortOrder,
            };
            const result = await searchProducts(params);
            res.json({ success: true, ...result });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
