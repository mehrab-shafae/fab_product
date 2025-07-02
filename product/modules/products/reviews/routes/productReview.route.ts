import { Router } from 'express';
import { addProductReviewController, getProductReviewsController, deleteProductReviewController } from '../controllers/productReview.controller.js';
import { validateProductReviewInput } from '../../middlewares/product.middleware.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(validateProductReviewInput), asyncHandler(addProductReviewController));
router.get('/', asyncHandler(getProductReviewsController));
router.delete('/:reviewId', asyncHandler(deleteProductReviewController));

export default router;
