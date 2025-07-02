import { Router } from 'express';
import { addProductTag, getProductTags, getProductsWithTag, removeProductTag } from '../controllers/productTag.controller.js';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(addProductTag));
router.get('/', asyncHandler(getProductTags));
router.get('/tags/:tagName', asyncHandler(getProductsWithTag));
router.delete('/:tagId', asyncHandler(removeProductTag));

export default router;
