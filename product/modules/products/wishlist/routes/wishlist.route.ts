import { Router } from 'express';
import { addToWishlistController, getWishlistController, removeFromWishlistController } from '../controllers/wishlist.controller';

const router = Router({ mergeParams: true });

router.post('/', addToWishlistController);
router.get('/', getWishlistController);
router.delete('/:wishlistId', removeFromWishlistController);

export default router; 