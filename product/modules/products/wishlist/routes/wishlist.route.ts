import { Router } from 'express';
import { addToWishlistController, getWishlistController, removeFromWishlistController } from '../controllers/wishlist.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(addToWishlistController));
router.get('/', asyncHandler(getWishlistController));
router.delete('/:wishlistId', asyncHandler(removeFromWishlistController));

export default router;
