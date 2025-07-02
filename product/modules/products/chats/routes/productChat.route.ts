import { Router } from 'express';
import { createProductChatController, getUserChatsController } from '../controllers/productChat.controller';

const router = Router({ mergeParams: true });

router.post('/', createProductChatController);
router.get('/users/:userId/chats', getUserChatsController);

export default router;
