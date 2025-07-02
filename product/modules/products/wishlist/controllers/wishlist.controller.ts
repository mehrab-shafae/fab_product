import { Request, Response } from 'express';
import { addToWishlist, getWishlist, removeFromWishlist } from '../services/wishlist.service';

export const addToWishlistController = async (req: Request, res: Response) => {
      try {
            const { userId } = req.params;
            const { product_id } = req.body;
            if (!userId || !product_id) {
                  return res.status(400).json({ success: false, error: 'Missing required fields' });
            }
            const item = await addToWishlist(userId, product_id);
            res.status(201).json({ success: true, data: item, message: 'Added to wishlist' });
      } catch (error) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getWishlistController = async (req: Request, res: Response) => {
      try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const result = await getWishlist(userId, Number(page), Number(limit));
            res.json({ success: true, ...result });
      } catch (error) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const removeFromWishlistController = async (req: Request, res: Response) => {
      try {
            const item = await removeFromWishlist(req.params.wishlistId);
            if (!item) return res.status(404).json({ success: false, error: 'Wishlist item not found' });
            res.json({ success: true, data: item, message: 'Removed from wishlist' });
      } catch (error) {
            res.status(400).json({ success: false, error: error.message });
      }
};
