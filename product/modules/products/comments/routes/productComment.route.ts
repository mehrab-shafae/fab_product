import { Router } from 'express';
import { addProductComment, getProductComments, removeProductComment } from '../controllers/productComment.controller.js';

const router = Router({ mergeParams: true });

// Add a comment to a product
router.post('/', asyncHandler(addProductComment));
// Get comments for a product
router.get('/', asyncHandler(getProductComments));
// Delete a comment by ID
router.delete('/:commentId', asyncHandler(removeProductComment));

export default router;
