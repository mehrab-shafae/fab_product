import { Router } from 'express';
import { addPriceHistoryController, getProductPriceHistoryController, getProductPriceStatisticsController } from '../controllers/productPriceHistory.controller';
import { validatePriceHistoryInput } from '../../middlewares/product.middleware';

const router = Router({ mergeParams: true });

router.post('/', validatePriceHistoryInput, addPriceHistoryController);
router.get('/', getProductPriceHistoryController);
router.get('/statistics', getProductPriceStatisticsController);

export default router; 