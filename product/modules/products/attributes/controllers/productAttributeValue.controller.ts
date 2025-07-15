import { Request, Response } from 'express';
import { addProductAttributeValue, getProductAttributeValues, getAllProductAttributeValues } from '../services/productAttributeValue.service.js';
import { ProductAttributeValue } from '../models/productAttributeValue.model.js';

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

export const replaceProductAttributesController = async (req: Request, res: Response) => {
      try {
            const productId = req.params.productId;
            const attributes = req.body.attributes;
            if (!Array.isArray(attributes)) {
                  return res.status(400).json({ success: false, error: 'attributes must be an array' });
            }
            // 1. همه attributeهای قبلی را soft-delete کن
            await ProductAttributeValue.updateMany(
                  { product_id: productId, deleted_at: null },
                  { deleted_at: new Date() }
            );
            // 2. فقط attributeهای جدید را اضافه یا آپدیت کن (deleted_at: null)
            for (const attr of attributes) {
                  if (Array.isArray(attr.value)) {
                        for (const v of attr.value) {
                              await ProductAttributeValue.findOneAndUpdate(
                                    { product_id: productId, attribute_id: attr.attribute_id, value: v },
                                    { value: v, deleted_at: null },
                                    { upsert: true, new: true }
                              );
                        }
                  } else {
                        await ProductAttributeValue.findOneAndUpdate(
                              { product_id: productId, attribute_id: attr.attribute_id },
                              { value: attr.value, deleted_at: null },
                              { upsert: true, new: true }
                        );
                  }
            }
            res.json({ success: true, message: 'Product attributes replaced successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
