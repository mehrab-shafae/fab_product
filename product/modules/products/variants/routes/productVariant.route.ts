import { Router } from 'express';
import { createProductVariantController, getProductVariantsController, deleteProductVariantController } from '../controllers/productVariant.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(createProductVariantController));
router.get('/', asyncHandler(getProductVariantsController));
router.delete('/:variantId', asyncHandler(deleteProductVariantController));

export default router;
