import { Request, Response } from 'express';
import { addTagToProduct, getTagsByProduct, getProductsByTag, deleteTag } from '../services/productTag.service.js';

export const addProductTag = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const tag = await addTagToProduct(data);
            res.status(201).json({ status: 'success', data: tag, message: 'Tag added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductTags = async (req: Request, res: Response) => {
      try {
            const tags = await getTagsByProduct(req.params.productId);
            res.json({ status: 'success', data: tags });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductsWithTag = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getProductsByTag(req.params.tagName, Number(page), Number(limit));
            res.json({ status: 'success', ...result });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const removeProductTag = async (req: Request, res: Response) => {
      try {
            const tag = await deleteTag(req.params.tagId);
            if (!tag) return res.status(404).json({ status: 'error', error: 'Tag not found' });
            res.json({ status: 'success', data: tag, message: 'Tag deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
