import { Router } from 'express';
import { addProductAttributeValueController, getProductAttributeValuesController, getAllProductAttributeValuesController } from '../controllers/productAttributeValue.controller.js';
import { validateProductAttributeValue } from '../../middlewares/product.middleware.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(validateProductAttributeValue), asyncHandler(addProductAttributeValueController));
router.get('/', asyncHandler(getProductAttributeValuesController));
router.get('/all', asyncHandler(getAllProductAttributeValuesController));

export default router;
