import { Router } from 'express';
import { addProductImageController, getProductImagesController, deleteProductImageController } from '../controllers/productImage.controller';

const router = Router({ mergeParams: true });

router.post('/', addProductImageController);
router.get('/', getProductImagesController);
router.delete('/:imageId', deleteProductImageController);

export default router; 