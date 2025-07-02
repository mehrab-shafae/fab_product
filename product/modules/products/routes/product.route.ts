import { Router } from 'express';
import { createProduct, getProductById, updateProduct, deleteProduct, searchProductsController } from '../controllers/product.controller';
import { validateProductId, validateRequiredFields, validateProductSchema, validateRequiredAttributesOnCreateProduct } from '../middlewares/product.middleware';
import { productCommentRouter } from '../comments';
import { productTagRouter } from '../tags';
import { productChatRouter, chatMessageRouter } from '../chats';
import { productImageRouter } from '../images';
import { productVariantRouter } from '../variants';
import { productInventoryRouter } from '../inventory';
import { productPriceHistoryRouter } from '../priceHistory';
import { productAttributeRouter, productAttributeValueRouter } from '../attributes';
import { productReviewRouter } from '../reviews';
import { wishlistRouter } from '../wishlist';
import { productVersionRouter } from '../versions';
import { productRelationshipRouter } from '../relationships';
import { productAnalyticsRouter } from '../analytics';

const router = Router();

router.post('/', validateProductSchema, validateRequiredAttributesOnCreateProduct, createProduct);
router.get('/:id', validateProductId, getProductById);
router.put('/:id', validateProductId, validateProductSchema, updateProduct);
router.delete('/:id', validateProductId, deleteProduct);
router.get('/', searchProductsController);

// اتصال روتر ویژگی به صورت مستقل
router.use('/attributes', productAttributeRouter);
// اتصال روتر مقدار ویژگی به عنوان زیرمجموعه product
router.use('/:productId/attributes', productAttributeValueRouter);
// اتصال روتر بررسی به عنوان زیرمجموعه product
router.use('/:productId/reviews', productReviewRouter);
// اتصال روتر کامنت به عنوان زیرمجموعه product
router.use('/:productId/comments', productCommentRouter);
// اتصال روتر تگ به عنوان زیرمجموعه product
router.use('/:productId/tags', productTagRouter);
// اتصال روتر چت به عنوان زیرمجموعه product
router.use('/:productId/chats', productChatRouter);
// پیام‌های چت به صورت مستقل
router.use('/chats/:chatId/messages', chatMessageRouter);
// اتصال روتر تصاویر به عنوان زیرمجموعه product
router.use('/:productId/images', productImageRouter);
// اتصال روتر واریانت به عنوان زیرمجموعه product
router.use('/:productId/variants', productVariantRouter);
// اتصال روتر موجودی به عنوان زیرمجموعه product
router.use('/:productId/inventory', productInventoryRouter);
// اتصال روتر تاریخچه قیمت به عنوان زیرمجموعه product
router.use('/:productId/price-history', productPriceHistoryRouter);
// اتصال روتر wishlist به عنوان مسیر مستقل کاربر
router.use('/users/:userId/wishlist', wishlistRouter);
// اتصال روتر نسخه به عنوان زیرمجموعه product
router.use('/:productId/versions', productVersionRouter);
// اتصال روتر روابط به عنوان زیرمجموعه product
router.use('/:productId/relationships', productRelationshipRouter);
// اتصال روتر آمار و آنالیتیکس به عنوان زیرمجموعه product
router.use('/:productId/analytics', productAnalyticsRouter);

export default router;
