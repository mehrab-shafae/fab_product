import { Router } from 'express';
import { createProductAttributeController, getProductAttributesController } from '../controllers/productAttribute.controller';

const router = Router();

router.post('/', createProductAttributeController);
router.get('/', getProductAttributesController);

export default router;
