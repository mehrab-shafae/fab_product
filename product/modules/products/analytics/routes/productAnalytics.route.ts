import { Router } from 'express';
import { getProductAnalyticsController, updateProductAnalyticsController } from '../controllers/productAnalytics.controller';

const router = Router({ mergeParams: true });

router.get('/', asyncHandler(getProductAnalyticsController));
router.put('/', asyncHandler(updateProductAnalyticsController));

export default router;
