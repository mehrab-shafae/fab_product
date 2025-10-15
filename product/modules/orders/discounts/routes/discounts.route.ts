import { Router } from 'express';
import * as controller from '../controllers/discounts.controller.js';

const router = Router();

// Create discount codes
router.post('/', controller.create);
router.post('/bulk', controller.bulk);

// Get discounts with filters
router.get('/', controller.getDiscountsWithFilters);
router.get('/list', controller.list); // Keep old endpoint for backward compatibility

// Get discount details and status
router.get('/status/:code', controller.statusByCode);
router.get('/detailed-status/:code', controller.getDetailedStatus);
router.get('/usage-history/:code', controller.getUsageHistory);
router.get('/:id', controller.get);

// Update and delete
router.patch('/:id', controller.update);
router.patch('/:id/status', controller.updateStatus);
router.delete('/:id', controller.remove);

// Apply discount
router.post('/apply', controller.apply);

export default router;
