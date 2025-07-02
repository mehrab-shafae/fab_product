import { Router } from 'express';
import { addProductImageController, getProductImagesController, deleteProductImageController } from '../controllers/productImage.controller';
import { validateProductImageInput } from '../../middlewares/product.middleware';

const router = Router({ mergeParams: true });

router.post('/', validateProductImageInput, addProductImageController);
router.get('/', getProductImagesController);
router.delete('/:imageId', deleteProductImageController);

export default router;
