import { Router } from 'express';
import * as favoriteController from '../controllers/favoriteController.js';

const router = Router();

// افزودن علاقه‌مندی
router.post('/users/:userId/favorites', asyncHandler(favoriteController.add));
// حذف علاقه‌مندی (با itemId و itemType)
router.delete('/users/:userId/favorites/:itemId', asyncHandler(favoriteController.remove));
// لیست علاقه‌مندی‌ها
router.get('/users/:userId/favorites', asyncHandler(favoriteController.list));

export default router; 