import { Router } from 'express';
import * as userDeviceController from '../controllers/userDeviceController.js';

const router = Router();

// ثبت دستگاه جدید
router.post('/users/:userId/devices', asyncHandler(userDeviceController.register));
// لیست دستگاه‌های کاربر
router.get('/users/:userId/devices', asyncHandler(userDeviceController.list));
// بروزرسانی زمان آخرین ورود دستگاه
router.put('/devices/:id/login', asyncHandler(userDeviceController.updateLogin));
// حذف دستگاه
router.delete('/devices/:id', asyncHandler(userDeviceController.remove));

export default router;
