import { Router } from 'express';
import { addProductReviewController, getProductReviewsController, deleteProductReviewController } from '../controllers/productReview.controller';
import { validateProductReviewInput } from '../../middlewares/product.middleware';

const router = Router({ mergeParams: true });

router.post('/', validateProductReviewInput, addProductReviewController);
router.get('/', getProductReviewsController);
router.delete('/:reviewId', deleteProductReviewController);

export default router; 