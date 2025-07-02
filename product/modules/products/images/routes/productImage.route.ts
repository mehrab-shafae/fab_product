import { Router } from 'express';
import { addProductImageController, getProductImagesController, deleteProductImageController } from '../controllers/productImage.controller.js';
import { validateProductImageInput } from '../../middlewares/product.middleware.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(validateProductImageInput), asyncHandler(addProductImageController));
router.get('/', asyncHandler(getProductImagesController));
router.delete('/:imageId', asyncHandler(deleteProductImageController));

export default router;
