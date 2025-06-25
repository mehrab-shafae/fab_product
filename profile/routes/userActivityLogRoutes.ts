import { Router } from 'express';
import * as userActivityLogController from '../controllers/userActivityLogController.js';

const router = Router();

// ثبت لاگ فعالیت جدید
router.post('/users/:userId/activity-logs', asyncHandler(userActivityLogController.create));
// لیست لاگ‌های فعالیت کاربر
router.get('/users/:userId/activity-logs', asyncHandler(userActivityLogController.list));

export default router;
