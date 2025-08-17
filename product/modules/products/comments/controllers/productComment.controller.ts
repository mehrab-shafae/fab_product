import { Request, Response } from 'express';
import { addComment, getCommentsByProduct, deleteComment } from '../services/productComment.service.js';

export const addProductComment = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const comment = await addComment(data);
            res.status(201).json({ status: 'success', data: comment, message: 'Comment added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductComments = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getCommentsByProduct(req.params.productId, Number(page), Number(limit));
            res.json({ status: 'success', ...result });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const removeProductComment = async (req: Request, res: Response) => {
      try {
            const comment = await deleteComment(req.params.commentId);
            if (!comment) return res.status(404).json({ status: 'error', error: 'Comment not found' });
            res.json({ status: 'success', data: comment, message: 'Comment deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
