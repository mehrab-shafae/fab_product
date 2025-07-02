import { Router } from 'express';
import { upsertProductInventoryController, getProductInventoryController, deleteProductInventoryController } from '../controllers/productInventory.controller';

const router = Router({ mergeParams: true });

router.post('/', upsertProductInventoryController);
router.get('/', getProductInventoryController);
router.delete('/:inventoryId', deleteProductInventoryController);

export default router; 