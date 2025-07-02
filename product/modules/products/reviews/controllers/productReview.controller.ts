import { Request, Response } from 'express';
import { addProductReview, getProductReviews, deleteProductReview } from '../services/productReview.service';

export const addProductReviewController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const review = await addProductReview(data);
            res.status(201).json({ success: true, data: review, message: 'Product review added successfully' });
      } catch (error) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductReviewsController = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getProductReviews(req.params.productId, Number(page), Number(limit));
            res.json({ success: true, ...result });
      } catch (error) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const deleteProductReviewController = async (req: Request, res: Response) => {
      try {
            const review = await deleteProductReview(req.params.reviewId);
            if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
            res.json({ success: true, data: review, message: 'Product review deleted successfully' });
      } catch (error) {
            res.status(400).json({ success: false, error: error.message });
      }
};
