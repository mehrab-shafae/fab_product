import { Router } from 'express';
import { upsertProductInventoryController, getProductInventoryController, deleteProductInventoryController } from '../controllers/productInventory.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(upsertProductInventoryController));
router.get('/', asyncHandler(getProductInventoryController));
router.delete('/:inventoryId', asyncHandler(deleteProductInventoryController));

export default router;
