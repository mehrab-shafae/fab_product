import { Router } from 'express';
import { createProduct, getProductById, updateProduct, deleteProduct } from '../controllers/product.controller';
import { validateProductId, validateRequiredFields } from '../middlewares/product.middleware';
import { productCommentRouter } from '../comments';
import { productTagRouter } from '../tags';
import { productChatRouter, chatMessageRouter } from '../chats';

const router = Router();

router.post('/', validateRequiredFields(['name', 'price']), createProduct);
router.get('/:id', validateProductId, getProductById);
router.put('/:id', validateProductId, updateProduct);
router.delete('/:id', validateProductId, deleteProduct);

// اتصال روتر کامنت به عنوان زیرمجموعه product
router.use('/:productId/comments', productCommentRouter);
// اتصال روتر تگ به عنوان زیرمجموعه product
router.use('/:productId/tags', productTagRouter);
// اتصال روتر چت به عنوان زیرمجموعه product
router.use('/:productId/chats', productChatRouter);
// پیام‌های چت به صورت مستقل
router.use('/chats/:chatId/messages', chatMessageRouter);

export default router; 