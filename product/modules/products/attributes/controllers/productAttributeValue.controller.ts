import { Request, Response } from 'express';
import { addProductAttributeValue, getProductAttributeValues, getAllProductAttributeValues, searchProductsByAttributes, searchProductsByAttributesOnly, searchProductsByCategorySlugsAndAttributes } from '../services/productAttributeValue.service.js';
import { ProductAttributeValue } from '../models/productAttributeValue.model.js';

export const addProductAttributeValueController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const value = await addProductAttributeValue(data);
            res.status(201).json({ status: 'success', data: value, message: 'Product attribute added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductAttributeValuesController = async (req: Request, res: Response) => {
      try {
            const values = await getProductAttributeValues(req.params.productId);
            res.json({
                  status: 'success',
                  data: values,
                  count: values.length,
                  message: `Found ${values.length} valid attribute values`,
            });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getAllProductAttributeValuesController = async (req: Request, res: Response) => {
      try {
            const values = await getAllProductAttributeValues(req.params.productId);
            const validCount = values.filter(v => v.has_valid_attribute).length;
            const invalidCount = values.filter(v => !v.has_valid_attribute).length;

            res.json({
                  status: 'success',
                  data: values,
                  summary: {
                        total: values.length,
                        valid: validCount,
                        invalid: invalidCount,
                  },
                  message: `Found ${values.length} attribute values (${validCount} valid, ${invalidCount} invalid)`,
            });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const replaceProductAttributesController = async (req: Request, res: Response) => {
      try {
            const productId = req.params.productId;
            const attributes = req.body.attributes;
            if (!Array.isArray(attributes)) {
                  return res.status(400).json({ status: 'error', error: 'attributes must be an array' });
            }
            // 1. همه attributeهای قبلی را soft-delete کن
            await ProductAttributeValue.updateMany({ product_id: productId, deleted_at: null }, { deleted_at: new Date() });
            // 2. فقط attributeهای جدید را اضافه یا آپدیت کن (deleted_at: null)
            for (const attr of attributes) {
                  if (Array.isArray(attr.value)) {
                        for (const v of attr.value) {
                              await ProductAttributeValue.findOneAndUpdate({ product_id: productId, attribute_id: attr.attribute_id, value: v }, { value: v, deleted_at: null }, { upsert: true, new: true });
                        }
                  } else {
                        await ProductAttributeValue.findOneAndUpdate({ product_id: productId, attribute_id: attr.attribute_id }, { value: attr.value, deleted_at: null }, { upsert: true, new: true });
                  }
            }
            res.json({ status: 'success', message: 'Product attributes replaced successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

function parsePositiveInt(val: any, def: number) {
      const n = parseInt(val, 10);
      return Number.isFinite(n) && n > 0 ? n : def;
}

export const searchProductByAttributesController = async (req: Request, res: Response) => {
      try {
            const filters = req.body.filters;
            const slugs = req.body.slugs;
            const page = parsePositiveInt(req.query.page, 1);
            const limit = parsePositiveInt(req.query.limit, 20);

            // Check if at least one of filters or slugs is provided
            if ((!filters || !Array.isArray(filters) || filters.length === 0) && (!slugs || !Array.isArray(slugs) || slugs.length === 0)) {
                  return res.status(400).json({
                        status: 'error',
                        error: 'At least one of filters or slugs must be provided',
                  });
            }

            // Validate filters if provided
            if (filters && Array.isArray(filters) && filters.length > 0) {
                  for (const f of filters) {
                        if (!f.attribute || !Array.isArray(f.values) || f.values.length === 0) {
                              return res.status(400).json({
                                    status: 'error',
                                    error: 'Each filter must have an attribute and a non-empty array of values',
                              });
                        }
                  }
            }

            const results = await searchProductsByAttributes(filters, slugs, page, limit);
            res.json({ status: 'success', ...results });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const searchProductByAttributesOnlyController = async (req: Request, res: Response) => {
      try {
            const filters = req.body.filters;
            const slugs = req.body.slugs;
            const page = parsePositiveInt(req.query.page, 1);
            const limit = parsePositiveInt(req.query.limit, 20);

            // Check if at least one of filters or slugs is provided
            if ((!filters || !Array.isArray(filters) || filters.length === 0) && (!slugs || !Array.isArray(slugs) || slugs.length === 0)) {
                  return res.status(400).json({
                        status: 'error',
                        error: 'At least one of filters or slugs must be provided',
                  });
            }

            // Validate filters if provided
            if (filters && Array.isArray(filters) && filters.length > 0) {
                  for (const f of filters) {
                        if (!f.attribute || !Array.isArray(f.values) || f.values.length === 0) {
                              return res.status(400).json({
                                    status: 'error',
                                    error: 'Each filter must have an attribute and a non-empty array of values',
                              });
                        }
                  }
            }

            const results = await searchProductsByAttributesOnly(filters, slugs, page, limit);
            res.json({ status: 'success', ...results });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

// فیلترها می‌توانند شامل description هم باشند (اختیاری)
// خروجی: هر محصول با matchingVariants (و هر واریانت با attributes شامل description)
export const searchProductsByCategorySlugsAndAttributesController = async (req: Request, res: Response) => {
    try {
        const categorySlugs = req.body.categorySlugs;
        // filters: [{ attribute, values, description? }]
        const filters = req.body.filters;
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 20);

        // Optional price range
        const rawMinPrice = req.body.minPrice;
        const rawMaxPrice = req.body.maxPrice;
        const minPrice = rawMinPrice === undefined || rawMinPrice === null || rawMinPrice === '' ? undefined : Number(rawMinPrice);
        const maxPrice = rawMaxPrice === undefined || rawMaxPrice === null || rawMaxPrice === '' ? undefined : Number(rawMaxPrice);
        if ((minPrice !== undefined && !Number.isFinite(minPrice)) || (maxPrice !== undefined && !Number.isFinite(maxPrice))) {
            return res.status(400).json({ status: 'error', error: 'minPrice/maxPrice must be valid numbers' });
        }
        if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
            return res.status(400).json({ status: 'error', error: 'minPrice cannot be greater than maxPrice' });
        }

        // Optional sorting
        const sortBy = req.body.sortBy as 'minPrice' | 'maxPrice' | undefined;
        const sortOrder = req.body.sortOrder as 'asc' | 'desc' | undefined;
        if (sortBy && sortBy !== 'minPrice' && sortBy !== 'maxPrice') {
            return res.status(400).json({ status: 'error', error: "sortBy must be one of: 'minPrice', 'maxPrice'" });
        }
        if (sortOrder && sortOrder !== 'asc' && sortOrder !== 'desc') {
            return res.status(400).json({ status: 'error', error: "sortOrder must be one of: 'asc', 'desc'" });
        }

        // Check if categorySlugs is provided (optional now; only validate if provided)
        if (categorySlugs !== undefined && (!Array.isArray(categorySlugs) || categorySlugs.length === 0)) {
            return res.status(400).json({ status: 'error', error: 'categorySlugs must be a non-empty array when provided' });
        }

        // Validate filters if provided
        if (filters && Array.isArray(filters) && filters.length > 0) {
            for (const f of filters) {
                if (!f.attribute || !Array.isArray(f.values) || f.values.length === 0) {
                    return res.status(400).json({ status: 'error', error: 'Each filter must have an attribute and a non-empty array of values' });
                }
            }
        }

        const results = await searchProductsByCategorySlugsAndAttributes(categorySlugs, filters, page, limit, minPrice, maxPrice, sortBy, sortOrder);
        res.json({ status: 'success', ...results });
    } catch (error: any) {
        res.status(400).json({ status: 'error', error: error.message });
    }
};
