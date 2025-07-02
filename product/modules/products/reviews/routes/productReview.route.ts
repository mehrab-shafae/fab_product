import { Router } from 'express';
import { addProductReviewController, getProductReviewsController, deleteProductReviewController } from '../controllers/productReview.controller';

const router = Router({ mergeParams: true });

router.post('/', addProductReviewController);
router.get('/', getProductReviewsController);
router.delete('/:reviewId', deleteProductReviewController);

export default router; 