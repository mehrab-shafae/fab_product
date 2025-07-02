import { Request, Response } from 'express';
import { addProductAttributeValue, getProductAttributeValues } from '../services/productAttributeValue.service';

export const addProductAttributeValueController = async (req: Request, res: Response) => {
  try {
    const data = { ...req.body, product_id: req.params.productId };
    const value = await addProductAttributeValue(data);
    res.status(201).json({ success: true, data: value, message: 'Product attribute added successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getProductAttributeValuesController = async (req: Request, res: Response) => {
  try {
    const values = await getProductAttributeValues(req.params.productId);
    res.json({ success: true, data: values });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}; 