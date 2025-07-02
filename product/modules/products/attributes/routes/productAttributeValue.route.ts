import { Router } from 'express';
import { addProductAttributeValueController, getProductAttributeValuesController } from '../controllers/productAttributeValue.controller';
import { validateProductAttributeValue } from '../../middlewares/product.middleware';

const router = Router({ mergeParams: true });

router.post('/', validateProductAttributeValue, addProductAttributeValueController);
router.get('/', getProductAttributeValuesController);

export default router;
