import { Request, Response } from 'express';
import { addProductRelationship, getProductRelationships, deleteProductRelationship } from '../services/productRelationship.service';

export const addProductRelationshipController = async (req: Request, res: Response) => {
  try {
    const data = { ...req.body, product_id: req.params.productId };
    const relationship = await addProductRelationship(data);
    res.status(201).json({ success: true, data: relationship, message: 'Product relationship added successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getProductRelationshipsController = async (req: Request, res: Response) => {
  try {
    const { relationship_type } = req.query;
    const relationships = await getProductRelationships(req.params.productId, relationship_type as string);
    res.json({ success: true, data: relationships });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteProductRelationshipController = async (req: Request, res: Response) => {
  try {
    const relationship = await deleteProductRelationship(req.params.relationshipId);
    if (!relationship) return res.status(404).json({ success: false, error: 'Relationship not found' });
    res.json({ success: true, data: relationship, message: 'Product relationship deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}; 