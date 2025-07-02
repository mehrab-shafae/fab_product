import { Router } from 'express';
import { addProductReviewController, getProductReviewsController, deleteProductReviewController } from '../controllers/productReview.controller';
import { validateProductReviewInput } from '../../middlewares/product.middleware';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(validateProductReviewInput), asyncHandler(addProductReviewController));
router.get('/', asyncHandler(getProductReviewsController));
router.delete('/:reviewId', asyncHandler(deleteProductReviewController));

export default router;
