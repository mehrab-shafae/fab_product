import { Router } from 'express';
import { addChatMessageController, getChatMessagesController, markChatMessagesAsReadController } from '../controllers/chatMessage.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(addChatMessageController));
router.get('/', asyncHandler(getChatMessagesController));
router.post('/read', asyncHandler(markChatMessagesAsReadController));

export default router;
