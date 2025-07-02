import { Request, Response } from 'express';
import { addTagToProduct, getTagsByProduct, getProductsByTag, deleteTag } from '../services/productTag.service.js';

export const addProductTag = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const tag = await addTagToProduct(data);
            res.status(201).json({ success: true, data: tag, message: 'Tag added successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductTags = async (req: Request, res: Response) => {
      try {
            const tags = await getTagsByProduct(req.params.productId);
            res.json({ success: true, data: tags });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductsWithTag = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getProductsByTag(req.params.tagName, Number(page), Number(limit));
            res.json({ success: true, ...result });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const removeProductTag = async (req: Request, res: Response) => {
      try {
            const tag = await deleteTag(req.params.tagId);
            if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });
            res.json({ success: true, data: tag, message: 'Tag deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
