import { Router } from 'express';
import * as userPreferenceController from '../controllers/userPreferenceController.js';

const router = Router();

// ثبت ترجیح جدید
router.post('/users/:userId/preferences', asyncHandler(userPreferenceController.set));
// لیست ترجیحات کاربر
router.get('/users/:userId/preferences', asyncHandler(userPreferenceController.list));
// حذف ترجیح
router.delete('/preferences/:id', asyncHandler(userPreferenceController.remove));

export default router;
