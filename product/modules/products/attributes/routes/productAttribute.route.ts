import { Router } from 'express';
import { createProductAttributeController, getProductAttributesController } from '../controllers/productAttribute.controller';

const router = Router();

router.post('/', asyncHandler(createProductAttributeController));
router.get('/', asyncHandler(getProductAttributesController));

export default router;
