import { Router } from 'express';
import { addChatMessageController, getChatMessagesController, markChatMessagesAsReadController } from '../controllers/chatMessage.controller';

const router = Router({ mergeParams: true });

router.post('/', addChatMessageController);
router.get('/', getChatMessagesController);
router.post('/read', markChatMessagesAsReadController);

export default router;
