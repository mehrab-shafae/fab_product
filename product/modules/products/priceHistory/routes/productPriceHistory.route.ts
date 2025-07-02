import { Router } from 'express';
import { addPriceHistoryController, getProductPriceHistoryController, getProductPriceStatisticsController } from '../controllers/productPriceHistory.controller';

const router = Router({ mergeParams: true });

router.post('/', addPriceHistoryController);
router.get('/', getProductPriceHistoryController);
router.get('/statistics', getProductPriceStatisticsController);

export default router; 