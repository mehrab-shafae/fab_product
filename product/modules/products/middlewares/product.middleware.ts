import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { productSchema } from '../schema/product.schema.js';
import { Category } from '../../categories/models/category.model.js';
import { getRequiredAttributesRecursive } from '../attributes/helpers/requiredAttributes.js';
import { CategoryAttributeOption } from '../../categories/models/categoryAttributeOption.model.js';
import { CategoryAttribute } from '../../categories/models/categoryAttribute.model.js';
import { Product } from '../models/product.model.js';
import { ProductVariant } from '../variants/models/productVariant.model.js';
import { User } from '../models/user.model.js';
import { ProductImage } from '../images/models/productImage.model.js';

export const validateProductId = (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid product ID. Must be a valid Mongo ObjectId.' });
      }
      next();
};

// TODO: check this middleware
export const validateRequiredFields = (fields: string[]) => (req: Request, res: Response, next: NextFunction) => {
      const missing = fields.filter(f => !req.body[f]);
      if (missing.length > 0) {
            return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }
      next();
};

export const validateProductSchema = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  // Joi validation
                  const { error, value } = productSchema.validate(req.body);
                  if (error) {
                        return res.status(400).json({ error: error.details[0].message });
                  }
                  // Check price > 0
                  if (typeof value.price === 'number' && value.price <= 0) {
                        return res.status(400).json({ error: 'Price must be a positive number.' });
                  }
                  // Check old_price > 0 if provided
                  if (typeof value.old_price === 'number' && value.old_price <= 0) {
                        return res.status(400).json({ error: 'Old price must be a positive number.' });
                  }
                  // Check category_id existence if provided
                  if (value.category_id) {
                        if (!mongoose.Types.ObjectId.isValid(value.category_id)) {
                              return res.status(400).json({ error: 'Invalid category_id. Must be a valid Mongo ObjectId.' });
                        }
                        const category = await Category.findById(value.category_id);
                        if (!category) {
                              return res.status(400).json({ error: 'Category not found.' });
                        }
                  }
                  req.body = value;
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};

export const validateRequiredAttributesOnCreateProduct = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  const { category_id, attributes } = req.body;
                  if (!category_id) return next();
                  const requiredAttrs = await getRequiredAttributesRecursive(category_id);
                  if (!requiredAttrs.length) return next();
                  for (const attr of requiredAttrs) {
                        const val = attributes?.find((v: any) => v.attribute_id?.toString() === attr._id.toString());
                        if (!val || val.value === undefined || val.value === null || val.value === '') {
                              return res.status(400).json({ error: `Attribute '${attr.name}' is required.` });
                        }
                        if (attr.type === 'number' && isNaN(Number(val.value))) {
                              return res.status(400).json({ error: `Attribute '${attr.name}' must be a number.` });
                        }
                        if (attr.type === 'enum') {
                              const options = await CategoryAttributeOption.find({ attributeId: attr._id }).lean();
                              const allowed = options.map(o => o.value);
                              if (Array.isArray(val.value)) {
                                    if (val.value.length === 0) {
                                          return res.status(400).json({ error: `Attribute '${attr.name}' must have at least one value.` });
                                    }
                                    for (const v of val.value) {
                                          if (!allowed.includes(v)) {
                                                return res.status(400).json({ error: `Attribute '${attr.name}' must be one of: ${allowed.join(', ')}` });
                                          }
                                    }
                              } else {
                                    if (!allowed.includes(val.value)) {
                                          return res.status(400).json({ error: `Attribute '${attr.name}' must be one of: ${allowed.join(', ')}` });
                                    }
                              }
                        }
                  }
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};

export const validateRequiredAttributesOnUpdateProduct = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  const { category_id, attributes } = req.body;
                  // اگر category_id در body نبود، از محصول فعلی بخوان
                  let catId = category_id;
                  if (!catId && req.params.id) {
                        const product = await Product.findById(req.params.id);
                        if (product) catId = product.category_id;
                  }
                  if (!catId) return next();
                  const requiredAttrs = await getRequiredAttributesRecursive(catId);
                  if (!requiredAttrs.length) return next();
                  for (const attr of requiredAttrs) {
                        const val = attributes?.find((v: any) => v.attribute_id?.toString() === attr._id.toString());
                        if (!val || val.value === undefined || val.value === null || val.value === '') {
                              return res.status(400).json({ error: `Attribute '${attr.name}' is required.` });
                        }
                        if (attr.type === 'number' && isNaN(Number(val.value))) {
                              return res.status(400).json({ error: `Attribute '${attr.name}' must be a number.` });
                        }
                        if (attr.type === 'enum') {
                              const options = await CategoryAttributeOption.find({ attributeId: attr._id }).lean();
                              const allowed = options.map(o => o.value);
                              if (Array.isArray(val.value)) {
                                    if (val.value.length === 0) {
                                          return res.status(400).json({ error: `Attribute '${attr.name}' must have at least one value.` });
                                    }
                                    for (const v of val.value) {
                                          if (!allowed.includes(v)) {
                                                return res.status(400).json({ error: `Attribute '${attr.name}' must be one of: ${allowed.join(', ')}` });
                                          }
                                    }
                              } else {
                                    if (!allowed.includes(val.value)) {
                                          return res.status(400).json({ error: `Attribute '${attr.name}' must be one of: ${allowed.join(', ')}` });
                                    }
                              }
                        }
                  }
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};

export const validateProductAttributeValue = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  const { productId } = req.params;
                  const { attribute_id, value } = req.body;
                  if (!productId || !attribute_id) return res.status(400).json({ error: 'productId and attribute_id are required.' });
                  // دریافت محصول
                  const product = await Product.findById(productId);
                  if (!product) return res.status(404).json({ error: 'Product not found.' });
                  // دریافت attribute
                  const attr = await CategoryAttribute.findById(attribute_id);
                  if (!attr) return res.status(404).json({ error: 'Attribute not found.' });
                  // بررسی تعلق attribute به دسته محصول
                  if (product.category_id?.toString() !== attr.categoryId.toString()) {
                        return res.status(400).json({ error: 'Attribute does not belong to the product category.' });
                  }
                  // بررسی نوع attribute
                  if (attr.type === 'number' && isNaN(Number(value))) {
                        return res.status(400).json({ error: `Attribute '${attr.name}' must be a number.` });
                  }
                  if (attr.type === 'enum') {
                        const options = await CategoryAttributeOption.find({ attributeId: attr._id }).lean();
                        const allowed = options.map(o => o.value);
                        if (!allowed.includes(value)) {
                              return res.status(400).json({ error: `Attribute '${attr.name}' must be one of: ${allowed.join(', ')}` });
                        }
                  }
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};

export const validatePriceHistoryInput = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  const { productId } = req.params;
                  const { price, variant_id, effective_date } = req.body;
                  // بررسی price
                  if (typeof price !== 'number' || price <= 0) {
                        return res.status(400).json({ error: 'Price must be a positive number.' });
                  }
                  // بررسی وجود محصول
                  const product = await Product.findById(productId);
                  if (!product || product.deleted_at) {
                        return res.status(404).json({ error: 'Product not found.' });
                  }
                  // بررسی وجود variant (در صورت داده شدن)
                  if (variant_id) {
                        if (!mongoose.Types.ObjectId.isValid(variant_id)) {
                              return res.status(400).json({ error: 'Invalid variant_id.' });
                        }
                        const variant = await ProductVariant.findById(variant_id);
                        if (!variant || variant.deleted_at) {
                              return res.status(404).json({ error: 'Variant not found.' });
                        }
                        // variant باید متعلق به همین محصول باشد
                        if (variant.product_id.toString() !== productId) {
                              return res.status(400).json({ error: 'Variant does not belong to the product.' });
                        }
                  }
                  // بررسی تاریخ (در صورت داده شدن)
                  if (effective_date && isNaN(Date.parse(effective_date))) {
                        return res.status(400).json({ error: 'Invalid effective_date.' });
                  }
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};

export const validateProductReviewInput = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  const { productId } = req.params;
                  const { user_id, rating } = req.body; // TODO: review_text
                  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
                        return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
                  }
                  const product = await Product.findById(productId);
                  if (!product || product.deleted_at) {
                        return res.status(404).json({ error: 'Product not found.' });
                  }
                  if (!user_id) {
                        return res.status(400).json({ error: 'user_id is required.' });
                  }
                  const user = await User.findOne({ user_id, deleted_at: null });
                  if (!user) {
                        return res.status(404).json({ error: 'User not found.' });
                  }
                  // if (!review_text || review_text.trim() === '') {
                  //   return res.status(400).json({ error: 'Review text is required.' });
                  // }
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};

export const validateProductImageInput = (req: Request, res: Response, next: NextFunction) => {
      (async () => {
            try {
                  const { productId } = req.params;
                  const { variant_id, image_id, is_primary, order_index } = req.body;
                  // بررسی وجود محصول
                  const product = await Product.findById(productId);
                  if (!product || product.deleted_at) {
                        return res.status(404).json({ error: 'Product not found.' });
                  }
                  // بررسی وجود variant (در صورت داده شدن)
                  if (variant_id) {
                        if (!mongoose.Types.ObjectId.isValid(variant_id)) {
                              return res.status(400).json({ error: 'Invalid variant_id.' });
                        }
                        const variant = await ProductVariant.findById(variant_id);
                        if (!variant || variant.deleted_at) {
                              return res.status(404).json({ error: 'Variant not found.' });
                        }
                        if (variant.product_id.toString() !== productId) {
                              return res.status(400).json({ error: 'Variant does not belong to the product.' });
                        }
                  }
                  // بررسی image_id
                  if (!image_id || typeof image_id !== 'string') {
                        return res.status(400).json({ error: 'image_id is required and must be a string.' });
                  }
                  // عدم تکرار image_id برای همین محصول/واریانت
                  const exists = await ProductImage.findOne({ product_id: productId, variant_id: variant_id || null, image_id, deleted_at: null });
                  if (exists) {
                        return res.status(409).json({ error: 'This image_id already exists for this product/variant.' });
                  }
                  // بررسی order_index
                  if (order_index !== undefined && (typeof order_index !== 'number' || isNaN(order_index))) {
                        return res.status(400).json({ error: 'order_index must be a number.' });
                  }
                  // بررسی یکتا بودن is_primary
                  if (is_primary) {
                        const primaryExists = await ProductImage.findOne({ product_id: productId, variant_id: variant_id || null, is_primary: true, deleted_at: null });
                        if (primaryExists) {
                              return res.status(409).json({ error: 'There is already a primary image for this product/variant.' });
                        }
                  }
                  next();
            } catch (err: any) {
                  next(err);
            }
      })();
};
