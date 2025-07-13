import { Request, Response } from 'express';
import { addProductAttributeValue, getProductAttributeValues, getAllProductAttributeValues } from '../services/productAttributeValue.service.js';

export const addProductAttributeValueController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const value = await addProductAttributeValue(data);
            res.status(201).json({ success: true, data: value, message: 'Product attribute added successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductAttributeValuesController = async (req: Request, res: Response) => {
      try {
            const values = await getProductAttributeValues(req.params.productId);
            res.json({ 
                  success: true, 
                  data: values,
                  count: values.length,
                  message: `Found ${values.length} valid attribute values`
            });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getAllProductAttributeValuesController = async (req: Request, res: Response) => {
      try {
            const values = await getAllProductAttributeValues(req.params.productId);
            const validCount = values.filter(v => v.has_valid_attribute).length;
            const invalidCount = values.filter(v => !v.has_valid_attribute).length;
            
            res.json({ 
                  success: true, 
                  data: values,
                  summary: {
                        total: values.length,
                        valid: validCount,
                        invalid: invalidCount
                  },
                  message: `Found ${values.length} attribute values (${validCount} valid, ${invalidCount} invalid)`
            });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
