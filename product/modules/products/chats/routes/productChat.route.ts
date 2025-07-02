import { Router } from 'express';
import { createProductChatController, getUserChatsController } from '../controllers/productChat.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(createProductChatController));
router.get('/users/:userId/chats', asyncHandler(getUserChatsController));

export default router;
