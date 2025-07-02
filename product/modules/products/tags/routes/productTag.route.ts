import { Router } from 'express';
import { addProductTag, getProductTags, getProductsWithTag, removeProductTag } from '../controllers/productTag.controller';

const router = Router({ mergeParams: true });

router.post('/', addProductTag);
router.get('/', getProductTags);
router.get('/tags/:tagName', getProductsWithTag);
router.delete('/:tagId', removeProductTag);

export default router;
