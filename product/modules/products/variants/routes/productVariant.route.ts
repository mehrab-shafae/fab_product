import { Router } from 'express';
import { createProductVariantController, getProductVariantsController, deleteProductVariantController } from '../controllers/productVariant.controller';

const router = Router({ mergeParams: true });

router.post('/', createProductVariantController);
router.get('/', getProductVariantsController);
router.delete('/:variantId', deleteProductVariantController);

export default router; 