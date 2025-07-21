import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model.js';
import { searchProducts } from '../services/product.service.js';
import { ProductAttributeValue } from '../attributes/models/productAttributeValue.model.js';

export const createProduct = async (req: Request, res: Response) => {
      try {
            // فقط فیلدهای مورد نیاز را از req.body بگیر
            let image_ids = req.body.image_ids;
            if (typeof image_ids === 'string') {
                  image_ids = [image_ids];
            }
            const productData: any = {
                  ...req.body,
                  image_ids,
                  img: req.body.img,
            };
            const product = new Product(productData);
            await product.save();
            // Save attribute values if provided
            if (req.body.attributes && Array.isArray(req.body.attributes)) {
                  for (const attr of req.body.attributes) {
                        if (Array.isArray(attr.value)) {
                              for (const v of attr.value) {
                                    await ProductAttributeValue.create({
                                          product_id: product._id,
                                          attribute_id: attr.attribute_id,
                                          value: v
                                    });
                              }
                        } else {
                              await ProductAttributeValue.create({
                                    product_id: product._id,
                                    attribute_id: attr.attribute_id,
                                    value: attr.value
                              });
                        }
                  }
            }
            res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductById = async (req: Request, res: Response) => {
      try {
            const product = await Product.findById(req.params.id);
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
            // Fetch attribute values for this product
            const attributes = await ProductAttributeValue.find({ product_id: product._id, deleted_at: null }).populate('attribute_id');
            const productObj = product.toObject();
            res.json({ success: true, data: { ...productObj, attributes, image_ids: productObj.image_ids, img: productObj.img } });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const updateProduct = async (req: Request, res: Response) => {
      try {
            // فقط فیلدهای مورد نیاز را از req.body بگیر
            let image_ids = req.body.image_ids;
            if (typeof image_ids === 'string') {
                  image_ids = [image_ids];
            }
            const updateData: any = {
                  ...req.body,
                  image_ids,
                  img: req.body.img,
            };
            const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

            // --- منطق جایگزینی کامل attributeها (replace) ---
            if (req.body.attributes && Array.isArray(req.body.attributes)) {
                  // 1. همه attributeهای قبلی را soft-delete کن
                  await ProductAttributeValue.updateMany(
                        { product_id: product._id, deleted_at: null },
                        { deleted_at: new Date() }
                  );
                  // 2. فقط attributeهای جدید را اضافه یا آپدیت کن (deleted_at: null)
                  for (const attr of req.body.attributes) {
                        if (Array.isArray(attr.value)) {
                              for (const v of attr.value) {
                                    await ProductAttributeValue.findOneAndUpdate(
                                          { product_id: product._id, attribute_id: attr.attribute_id, value: v },
                                          { value: v, deleted_at: null },
                                          { upsert: true, new: true }
                                    );
                              }
                        } else {
                              await ProductAttributeValue.findOneAndUpdate(
                                    { product_id: product._id, attribute_id: attr.attribute_id },
                                    { value: attr.value, deleted_at: null },
                                    { upsert: true, new: true }
                              );
                        }
                  }
            }
            // --- پایان منطق جایگزینی کامل attributeها ---

            res.json({ success: true, data: product, message: 'Product updated successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const deleteProduct = async (req: Request, res: Response) => {
      try {
            const product = await Product.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
            res.json({ success: true, data: product, message: 'Product deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const searchProductsController = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      try {
            // تبدیل query string به پارامترهای مناسب
            const { page = 1, limit = 10, name, category_id, min_price, max_price, tags, sortField, sortOrder, ...rest } = req.query;
            // attributes را به صورت آبجکت دریافت کنیم (مثلاً attributes[brand]=X)
            let attributes: any = {};
            Object.keys(rest).forEach(key => {
                  if (key.startsWith('attributes[') && key.endsWith(']')) {
                        const attrKey = key.slice(11, -1);
                        attributes[attrKey] = rest[key];
                  }
            });
            const params = {
                  page,
                  limit,
                  name,
                  category_id,
                  min_price,
                  max_price,
                  tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
                  attributes,
                  sortField,
                  sortOrder,
            };
            const result = await searchProducts(params);
            res.json({ success: true, ...result });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
