import { Router } from 'express';
import { addProductAttributeValueController, getProductAttributeValuesController } from '../controllers/productAttributeValue.controller';

const router = Router({ mergeParams: true });

router.post('/', addProductAttributeValueController);
router.get('/', getProductAttributeValuesController);

export default router; 