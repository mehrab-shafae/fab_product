import { Router } from 'express';
import { createProductAttributeController, getProductAttributesController } from '../controllers/productAttribute.controller.js';

const router = Router();

router.post('/', asyncHandler(createProductAttributeController));
router.get('/', asyncHandler(getProductAttributesController));

export default router;
