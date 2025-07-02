import { Router } from 'express';
import { createProductVersionController, getProductVersionsController, deleteProductVersionController } from '../controllers/productVersion.controller';

const router = Router({ mergeParams: true });

router.post('/', createProductVersionController);
router.get('/', getProductVersionsController);
router.delete('/:versionId', deleteProductVersionController);

export default router; 