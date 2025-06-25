import { Router } from 'express';
import * as userSocialLinkController from '../controllers/userSocialLinkController.js';

const router = Router();

// ایجاد شبکه اجتماعی جدید
router.post('/users/:userId/social-links', asyncHandler(userSocialLinkController.create));
// لیست شبکه‌های اجتماعی کاربر
router.get('/users/:userId/social-links', asyncHandler(userSocialLinkController.list));
// ویرایش شبکه اجتماعی
router.put('/social-links/:id', asyncHandler(userSocialLinkController.update));
// حذف شبکه اجتماعی
router.delete('/social-links/:id', asyncHandler(userSocialLinkController.remove));

export default router; 