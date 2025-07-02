import { Router } from 'express';
import { createProduct, getProductById, updateProduct, deleteProduct, searchProductsController } from '../controllers/product.controller.js';
import { validateProductId, validateProductSchema, validateRequiredAttributesOnCreateProduct } from '../middlewares/product.middleware.js';
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

router.use('/attributes', productAttributeRouter);
router.use('/:productId/attributes', productAttributeValueRouter);
router.use('/:productId/reviews', productReviewRouter);
router.use('/:productId/comments', productCommentRouter);
router.use('/:productId/tags', productTagRouter);
router.use('/:productId/chats', productChatRouter);
router.use('/chats/:chatId/messages', chatMessageRouter);
router.use('/:productId/images', productImageRouter);
router.use('/:productId/variants', productVariantRouter);
router.use('/:productId/inventory', productInventoryRouter);
router.use('/:productId/price-history', productPriceHistoryRouter);
router.use('/users/:userId/wishlist', wishlistRouter);
router.use('/:productId/versions', productVersionRouter);
router.use('/:productId/relationships', productRelationshipRouter);
router.use('/:productId/analytics', productAnalyticsRouter);

export default router;
