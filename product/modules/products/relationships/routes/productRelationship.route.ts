import { Router } from 'express';
import { addProductRelationshipController, getProductRelationshipsController, deleteProductRelationshipController } from '../controllers/productRelationship.controller';

const router = Router({ mergeParams: true });

router.post('/', addProductRelationshipController);
router.get('/', getProductRelationshipsController);
router.delete('/:relationshipId', deleteProductRelationshipController);

export default router; 