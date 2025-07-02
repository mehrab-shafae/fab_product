import { Router } from 'express';
import { createProduct, getProductById, updateProduct, deleteProduct, searchProductsController } from '../controllers/product.controller.js';
import { validateProductId, validateRequiredFields, validateProductSchema, validateRequiredAttributesOnCreateProduct } from '../middlewares/product.middleware.js';
import { productCommentRouter } from '../comments/index.js';
import { productTagRouter } from '../tags/index.js';
import { productChatRouter, chatMessageRouter } from '../chats/index.js';
import { productImageRouter } from '../images/index.js';
import { productVariantRouter } from '../variants/index.js';
import { productInventoryRouter } from '../inventory/index.js';
import { productPriceHistoryRouter } from '../priceHistory/index.js';
import { productAttributeRouter, productAttributeValueRouter } from '../attributes/index.js';
import { productReviewRouter } from '../reviews/index.js';
import { wishlistRouter } from '../wishlist/index.js';
import { productVersionRouter } from '../versions/index.js';
import { productRelationshipRouter } from '../relationships/index.js';
import { productAnalyticsRouter } from '../analytics/index.js';

const router = Router();

router.post('/', asyncHandler(validateProductSchema), asyncHandler(validateRequiredAttributesOnCreateProduct), asyncHandler(createProduct));
router.get('/:id', asyncHandler(validateProductId), asyncHandler(getProductById));
router.put('/:id', asyncHandler(validateProductId), asyncHandler(validateProductSchema), asyncHandler(updateProduct));
router.delete('/:id', asyncHandler(validateProductId), asyncHandler(deleteProduct));
router.get('/', asyncHandler(searchProductsController));

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
