import { Router } from 'express';
import { createProductVersionController, getProductVersionsController, deleteProductVersionController } from '../controllers/productVersion.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(createProductVersionController));
router.get('/', asyncHandler(getProductVersionsController));
router.delete('/:versionId', asyncHandler(deleteProductVersionController));

export default router;
