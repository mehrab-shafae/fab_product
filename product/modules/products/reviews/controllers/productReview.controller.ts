import { Request, Response } from 'express';
import { addProductReview, getProductReviews, deleteProductReview } from '../services/productReview.service.js';

export const addProductReviewController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const review = await addProductReview(data);
            res.status(201).json({ status: 'success', data: review, message: 'Product review added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductReviewsController = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getProductReviews(req.params.productId, Number(page), Number(limit));
            res.json({ status: 'success', ...result });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const deleteProductReviewController = async (req: Request, res: Response) => {
      try {
            const review = await deleteProductReview(req.params.reviewId);
            if (!review) return res.status(404).json({ status: 'error', error: 'Review not found' });
            res.json({ status: 'success', data: review, message: 'Product review deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
