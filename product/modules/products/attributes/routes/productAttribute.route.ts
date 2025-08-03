import { Router } from 'express';
import { createProductAttributeController, getProductAttributesController } from '../controllers/productAttribute.controller.js';
import { searchProductByAttributesController } from '../controllers/productAttributeValue.controller.js'; // searchProductByAttributesOnlyController

const router = Router();

router.post('/', asyncHandler(createProductAttributeController));
router.get('/', asyncHandler(getProductAttributesController));
router.post('/search', asyncHandler(searchProductByAttributesController));
//router.post('/search-only', asyncHandler(searchProductByAttributesOnlyController));

export default router;
