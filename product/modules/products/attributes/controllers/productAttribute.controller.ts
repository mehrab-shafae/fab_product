import { Request, Response } from 'express';
import { createProductAttribute, getProductAttributes } from '../services/productAttribute.service.js';

export const createProductAttributeController = async (req: Request, res: Response) => {
      try {
            const attribute = await createProductAttribute(req.body);
            res.status(201).json({ status: 'success', data: attribute, message: 'Attribute created successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductAttributesController = async (_req: Request, res: Response) => {
      try {
            const attributes = await getProductAttributes();
            res.json({ status: 'success', data: attributes });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
