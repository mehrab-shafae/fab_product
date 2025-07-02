import { Router } from 'express';
import { getProductAnalyticsController, updateProductAnalyticsController } from '../controllers/productAnalytics.controller';

const router = Router({ mergeParams: true });

router.get('/', getProductAnalyticsController);
router.put('/', updateProductAnalyticsController);

export default router;
