import { Router } from 'express';
import * as userNotificationController from '../controllers/userNotificationController.js';

const router = Router();

// ثبت اعلان جدید
router.post('/users/:userId/notifications', asyncHandler(userNotificationController.create));
// لیست اعلان‌های کاربر
router.get('/users/:userId/notifications', asyncHandler(userNotificationController.list));
// خواندن اعلان
router.put('/notifications/:id/read', asyncHandler(userNotificationController.read));
// حذف اعلان
router.delete('/notifications/:id', asyncHandler(userNotificationController.remove));

export default router;
