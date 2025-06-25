import { Router } from 'express';
import * as userBlockController from '../controllers/userBlockController.js';

const router = Router();

// بلاک کاربر
router.post('/users/:userId/blocks/user', asyncHandler(userBlockController.blockUserCtrl));
// بلاک آیتم
router.post('/users/:userId/blocks/item', asyncHandler(userBlockController.blockItemCtrl));
// لیست بلاک‌ها
router.get('/users/:userId/blocks', asyncHandler(userBlockController.list));
// آنبلاک
router.delete('/blocks/:id', asyncHandler(userBlockController.unblockCtrl));

export default router;