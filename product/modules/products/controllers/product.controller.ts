import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model.js';
import { searchProducts } from '../services/product.service.js';
import { ProductAttributeValue } from '../attributes/models/productAttributeValue.model.js';
import { ProductAttribute } from '../attributes/models/productAttribute.model.js';
import { Category } from '../../categories/models/category.model.js';
import { CategoryAttribute } from '../../categories/models/categoryAttribute.model.js';
import mongoose from 'mongoose';

function generateSlug(input: string): string {
      return input.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * تابع کمکی برای تبدیل CategoryAttribute به ProductAttribute
 * @param categoryAttributeId - شناسه CategoryAttribute
 * @returns ProductAttribute یا null در صورت خطا
 */
async function getOrCreateProductAttribute(categoryAttributeId: string): Promise<{ success: boolean; productAttribute?: any; error?: string }> {
      try {
            // ابتدا CategoryAttribute را پیدا کن
            const categoryAttribute = await CategoryAttribute.findById(categoryAttributeId);
            if (!categoryAttribute) {
                  return { success: false, error: `CategoryAttribute with id '${categoryAttributeId}' not found` };
            }

            // بررسی اینکه آیا ProductAttribute مربوطه وجود دارد یا نه
            let productAttribute = await ProductAttribute.findOne({ 
                  name: categoryAttribute.name,
                  deleted_at: null 
            });

            // اگر ProductAttribute وجود نداشت، آن را ایجاد کن
            if (!productAttribute) {
                  productAttribute = await ProductAttribute.create({
                        name: categoryAttribute.name,
                        data_type: categoryAttribute.type,
                        options: categoryAttribute.type === 'enum' ? [] : undefined
                  });
            }

            return { success: true, productAttribute };
      } catch (error: any) {
            return { success: false, error: error.message };
      }
}

/**
 * تابع کمکی برای دریافت attributes محصول با اطلاعات کامل
 * @param productId - شناسه محصول
 * @returns آرایه‌ای از attributes با اطلاعات کامل
 */
async function getProductAttributesWithDetails(productId: mongoose.Types.ObjectId) {
      const attributes = await ProductAttributeValue.find({ 
            product_id: productId, 
            deleted_at: null 
      }).populate('attribute_id');
      
      return attributes;
}

export const createProduct = async (req: Request, res: Response) => {
      try {
            // فقط فیلدهای مورد نیاز را از req.body بگیر
            let image_ids = req.body.image_ids;
            if (typeof image_ids === 'string') {
                  image_ids = [image_ids];
            }
            // --- SLUG LOGIC ---
            let slug = req.body.slug;
            if (slug && typeof slug === 'string') {
                  slug = generateSlug(slug);
            } else {
                  slug = generateSlug(req.body.name || '');
            }
            // Check uniqueness
            const exists = await Product.findOne({ slug });
            if (exists) {
                  return res.status(400).json({ success: false, error: 'Slug already exists' });
            }
            // --- END SLUG LOGIC ---

            // --- SKU LOGIC ---
            let sku = null;
            if (!req.body.category_id) {
                  return res.status(400).json({ success: false, error: 'category_id is required for SKU generation' });
            }
            const category = await Category.findById(req.body.category_id);
            if (!category) {
                  return res.status(400).json({ success: false, error: 'Category not found' });
            }
            // پیدا کردن بزرگ‌ترین sku فعلی برای این دسته
            const lastProduct = await Product.find({ category_id: category._id }).sort({ sku: -1 }).limit(1);
            let baseSku = (typeof category.baseSku === 'number' && !isNaN(category.baseSku) && category.baseSku > 0) ? category.baseSku : 1000;
            if (lastProduct.length === 0) {
                  sku = baseSku + 1;
            } else if (typeof lastProduct[0].sku === 'number' && !isNaN(lastProduct[0].sku) && lastProduct[0].sku > 0) {
                  sku = lastProduct[0].sku + 1;
            } else {
                  sku = baseSku + 1;
            }
            // --- END SKU LOGIC ---

            const productData: any = {
                  ...req.body,
                  slug, // always use processed slug
                  image_ids,
                  img: req.body.img,
                  sku, // مقداردهی sku
            };
            const product = new Product(productData);
            await product.save();

            // Save attribute values if provided
            if (req.body.attributes && Array.isArray(req.body.attributes)) {
                for (const attr of req.body.attributes) {
                    // بررسی اعتبار attribute_id
                    if (!attr.attribute_id || !mongoose.Types.ObjectId.isValid(attr.attribute_id)) {
                        return res.status(400).json({ success: false, error: `Invalid or missing attribute_id for attribute value '${attr.value}'` });
                    }

                    // تبدیل CategoryAttribute به ProductAttribute
                    const result = await getOrCreateProductAttribute(attr.attribute_id);
                    if (!result.success) {
                        return res.status(400).json({ success: false, error: result.error });
                    }

                    // حالا ProductAttributeValue را با ProductAttribute._id ذخیره کن
                    if (Array.isArray(attr.value)) {
                        for (const v of attr.value) {
                            await ProductAttributeValue.create({
                                product_id: product._id,
                                attribute_id: result.productAttribute._id,
                                value: v,
                            });
                        }
                    } else {
                        await ProductAttributeValue.create({
                            product_id: product._id,
                            attribute_id: result.productAttribute._id,
                            value: attr.value,
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
            const attributes = await getProductAttributesWithDetails(product._id as mongoose.Types.ObjectId);
            const productObj = product.toObject();
            res.json({ success: true, data: { ...productObj, attributes, image_ids: productObj.image_ids, img: productObj.img } });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductBySlug = async (req: Request, res: Response) => {
      try {
            const product = await Product.findOne({ slug: req.params.slug });
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
            // Fetch attribute values for this product
            const attributes = await getProductAttributesWithDetails(product._id as mongoose.Types.ObjectId);
            const productObj = product.toObject();
            res.json({ success: true, data: { ...productObj, attributes, image_ids: productObj.image_ids, img: productObj.img } });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const updateProduct = async (req: Request, res: Response) => {
      try {
            let image_ids = req.body.image_ids;
            if (typeof image_ids === 'string') {
                  image_ids = [image_ids];
            }
            // --- SLUG LOGIC ---
            const productId = req.params.id;
            const currentProduct = await Product.findById(productId);
            if (!currentProduct) return res.status(404).json({ success: false, error: 'Product not found' });
            let slug = req.body.slug;
            if (slug && typeof slug === 'string') {
                  slug = generateSlug(slug);
            } else if (req.body.name) {
                  slug = generateSlug(req.body.name);
            } else {
                  slug = currentProduct.slug;
            }
            // Check uniqueness only if slug changed
            if (slug !== currentProduct.slug) {
                  const exists = await Product.findOne({ slug });
                  if (exists && exists._id && exists._id.toString() !== productId) {
                        return res.status(400).json({ success: false, error: 'Slug already exists' });
                  }
            }
            // --- END SLUG LOGIC ---
            const updateData: any = {
                  ...req.body,
                  slug, // always use processed slug
                  image_ids,
                  img: req.body.img,
            };
            const product = await Product.findByIdAndUpdate(productId, updateData, { new: true });
            if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

            // --- منطق جایگزینی کامل attributeها (replace) ---
            if (req.body.attributes && Array.isArray(req.body.attributes)) {
                  // 1. همه attributeهای قبلی را soft-delete کن
                  await ProductAttributeValue.updateMany({ product_id: product._id, deleted_at: null }, { deleted_at: new Date() });
                  // 2. فقط attributeهای جدید را اضافه یا آپدیت کن (deleted_at: null)
                  for (const attr of req.body.attributes) {
                        // تبدیل CategoryAttribute به ProductAttribute
                        const result = await getOrCreateProductAttribute(attr.attribute_id);
                        if (!result.success) {
                              return res.status(400).json({ success: false, error: result.error });
                        }

                        // حالا ProductAttributeValue را با ProductAttribute._id ذخیره کن
                        if (Array.isArray(attr.value)) {
                              for (const v of attr.value) {
                                    await ProductAttributeValue.findOneAndUpdate(
                                          { product_id: product._id, attribute_id: result.productAttribute._id, value: v }, 
                                          { value: v, deleted_at: null }, 
                                          { upsert: true, new: true }
                                    );
                              }
                        } else {
                              await ProductAttributeValue.findOneAndUpdate(
                                    { product_id: product._id, attribute_id: result.productAttribute._id }, 
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
            // --- Add full category info to each product ---
            const categoryIds = result.items.map((p: any) => p.category_id).filter(Boolean);
            const uniqueCategoryIds = [...new Set(categoryIds.map((id: any) => id.toString()))];
            const categories = await Category.find({ _id: { $in: uniqueCategoryIds } }).lean();
            const categoriesMap = Object.fromEntries(categories.map((cat: any) => [cat._id.toString(), cat]));
            const productsWithCategory = result.items.map((product: any) => ({
                  ...product,
                  category: categoriesMap[product.category_id?.toString()] || null,
            }));
            res.json({ success: true, ...result, items: productsWithCategory });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};

export const getProductsByIds = async (req: Request, res: Response) => {
      try {
            const { productIds } = req.body;
            
            if (!Array.isArray(productIds)) {
                  return res.status(400).json({ success: false, error: 'productIds must be an array' });
            }

            if (productIds.length === 0) {
                  return res.status(400).json({ success: false, error: 'productIds array cannot be empty' });
            }

            const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            if (validIds.length === 0) {
                  return res.status(400).json({ success: false, error: 'No valid product IDs provided' });
            }

            const products = await Product.find({ _id: { $in: validIds } });
            
            const productsWithAttributes = await Promise.all(
                  products.map(async (product) => {
                        const attributes = await getProductAttributesWithDetails(product._id as mongoose.Types.ObjectId);
                        const productObj = product.toObject();
                        return { ...productObj, attributes, image_ids: productObj.image_ids, img: productObj.img };
                  })
            );

            const productsMap = new Map(productsWithAttributes.map(product => [product._id?.toString(), product]));
            
            const orderedProducts = productIds
                  .filter(id => mongoose.Types.ObjectId.isValid(id))
                  .map(id => productsMap.get(id))
                  .filter(Boolean);

            res.json({ success: true, data: orderedProducts });
      } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
      }
};
