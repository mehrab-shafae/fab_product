import { Router } from 'express';
import { addProductAttributeValueController, getProductAttributeValuesController, getAllProductAttributeValuesController, replaceProductAttributesController } from '../controllers/productAttributeValue.controller.js';
import { validateProductAttributeValue, validateReplaceProductAttributes } from '../../middlewares/product.middleware.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(validateProductAttributeValue), asyncHandler(addProductAttributeValueController));
router.get('/', asyncHandler(getProductAttributeValuesController));
router.get('/all', asyncHandler(getAllProductAttributeValuesController));
router.put('/', asyncHandler(validateReplaceProductAttributes), asyncHandler(replaceProductAttributesController));

export default router;
