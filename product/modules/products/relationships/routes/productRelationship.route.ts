import { Router } from 'express';
import { addProductRelationshipController, getProductRelationshipsController, deleteProductRelationshipController } from '../controllers/productRelationship.controller';

const router = Router({ mergeParams: true });

router.post('/', asyncHandler(addProductRelationshipController));
router.get('/', asyncHandler(getProductRelationshipsController));
router.delete('/:relationshipId', asyncHandler(deleteProductRelationshipController));

export default router;
