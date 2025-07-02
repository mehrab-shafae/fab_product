import { Request, Response } from 'express';
import { createProductAttribute, getProductAttributes } from '../services/productAttribute.service.js';

export const createProductAttributeController = async (req: Request, res: Response) => {
      try {
            const attribute = await createProductAttribute(req.body);
            res.status(201).json({ success: true, data: attribute, message: 'Attribute created successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductAttributesController = async (_req: Request, res: Response) => {
      try {
            const attributes = await getProductAttributes();
            res.json({ success: true, data: attributes });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
