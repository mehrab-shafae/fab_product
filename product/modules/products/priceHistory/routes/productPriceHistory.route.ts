import { Router } from 'express';
import { addPriceHistoryController, getProductPriceHistoryController, getProductPriceStatisticsController } from '../controllers/productPriceHistory.controller.js';
import { validatePriceHistoryInput } from '../../middlewares/product.middleware.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(validatePriceHistoryInput), asyncHandler(addPriceHistoryController));
router.get('/', asyncHandler(getProductPriceHistoryController));
router.get('/statistics', asyncHandler(getProductPriceStatisticsController));

export default router;
