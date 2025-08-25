import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model.js';
import { searchProducts } from '../services/product.service.js';
import { ProductAttributeValue } from '../attributes/models/productAttributeValue.model.js';
import { Category } from '../../categories/models/category.model.js';
import mongoose from 'mongoose';
import { categoriesService } from '../../categories/index.js';

function generateSlug(input: string): string {
      return input.trim().toLowerCase().replace(/\s+/g, '-');
}

/*function generateRandomSkuBase(): string {
      const lettersCount = Math.random() < 0.5 ? 1 : 2;
      const letters = Array.from({ length: lettersCount })
            .map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
            .join('');
      const number = Math.floor(100 + Math.random() * (99999 - 100 + 1));
      return `${letters}${number}`;
}

async function generateUniqueSku(usedInRequest: Set<string>): Promise<string> {
      for (let i = 0; i < 20; i++) {
            const candidate = generateRandomSkuBase();
            if (usedInRequest.has(candidate)) continue;
            const exists = await Product.exists({ 'variants.sku': candidate });
            if (!exists) {
                  usedInRequest.add(candidate);
                  return candidate;
            }
      }
      throw new Error('Failed to generate a unique SKU after multiple attempts');
}*/

/**
 * تابع کمکی برای تبدیل CategoryAttribute به ProductAttribute
 * @param categoryAttributeId - شناسه CategoryAttribute
 * @returns ProductAttribute یا null در صورت خطا
 */
/*async function getOrCreateProductAttribute(categoryAttributeId: string): Promise<{ status: string; productAttribute?: any; error?: string }> {
      try {
            // ابتدا CategoryAttribute را پیدا کن
            const categoryAttribute = await CategoryAttribute.findById(categoryAttributeId);
            if (!categoryAttribute) {
                  return { status: 'error', error: `CategoryAttribute with id '${categoryAttributeId}' not found` };
            }

            // بررسی اینکه آیا ProductAttribute مربوطه وجود دارد یا نه
            let productAttribute = await ProductAttribute.findOne({
                  name: categoryAttribute.name,
                  deleted_at: null,
            });

            // اگر ProductAttribute وجود نداشت، آن را ایجاد کن
            if (!productAttribute) {
                  productAttribute = await ProductAttribute.create({
                        name: categoryAttribute.name,
                        data_type: categoryAttribute.type,
                        options: categoryAttribute.type === 'enum' ? [] : undefined,
                  });
            }

            return { status: 'success', productAttribute };
      } catch (error: any) {
            return { status: 'error', error: error.message };
      }
}*/

/**
 * تابع کمکی برای دریافت attributes محصول با اطلاعات کامل
 * @param productId - شناسه محصول
 * @returns آرایه‌ای از attributes با اطلاعات کامل
 */
async function getProductAttributesWithDetails(productId: mongoose.Types.ObjectId) {
      const attributes = await ProductAttributeValue.find({
            product_id: productId,
            deleted_at: null,
      }).populate('attribute_id');

      return attributes;
}

export const createProduct = async (req: Request, res: Response) => {
      try {
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
                  return res.status(400).json({ status: 'error', error: 'Slug already exists' });
            }
            // --- END SLUG LOGIC ---

            // --- SKU LOGIC ---
            if (!req.body.category_id) {
                  return res.status(400).json({ status: 'error', error: 'category_id is required for SKU generation' });
            }
            const category = await Category.findById(req.body.category_id);
            if (!category) {
                  return res.status(400).json({ status: 'error', error: 'Category not found' });
            }
            let lastProduct = await Product.find({ category_id: category._id }).sort({ created_at: -1 }).limit(1);
            let baseSku = typeof category.baseSku === 'number' && !isNaN(category.baseSku) && category.baseSku > 0 ? category.baseSku : 1000;
            let nextSku = baseSku + 1;
            if (lastProduct.length > 0) {
                  // اگر محصول قبلی variants داشت، بزرگترین sku را از variants پیدا کن
                  let maxSku = baseSku;
                  const prev = lastProduct[0] as any;
                  if (Array.isArray(prev.variants) && prev.variants.length > 0) {
                        for (const v of prev.variants) {
                              if (v.sku && !isNaN(Number(v.sku)) && Number(v.sku) > maxSku) {
                                    maxSku = Number(v.sku);
                              }
                        }
                  } else if ('sku' in prev && prev.sku && !isNaN(Number(prev.sku)) && Number(prev.sku) > maxSku) {
                        maxSku = Number(prev.sku);
                  }
                  nextSku = maxSku + 1;
            }
            // --- END SKU LOGIC ---

            let productData: any = {
                  ...req.body,
                  slug,
                  image_ids,
                  img: req.body.img,
            };

            // اگر variants وجود داشت
            if (Array.isArray(req.body.variants) && req.body.variants.length > 0) {
                  productData.variants = [];
                  for (const [i, variant] of req.body.variants.entries()) {
                        let variantObj: any = { ...variant };
                        // attributes: array of { attribute_id, value }
                        if (Array.isArray(variant.attributes)) {
                              variantObj.attributes = [];
                              for (const attr of variant.attributes) {
                                    // تبدیل CategoryAttribute به ProductAttribute
                                    /*const result = await getOrCreateProductAttribute(attr.attribute_id);
                                    if (result.status !== 'success') {
                                          return res.status(400).json({ status: 'error', error: result.error });
                                    }*/
                                    variantObj.attributes.push({
                                          attribute_id: attr.attribute_id,
                                          value: attr.value,
                                    });
                              }
                        }
                        // sku: اگر کاربر مقدار نداد، خودکار مقداردهی کن
                        if (!variant.sku) {
                              variantObj.sku = `${nextSku + i}`;
                        }
                        // console.log('variantObj.sku:', variantObj.sku)

                        // const usedSkus = new Set<string>();

                        // if (!variant.sku) {
                        //       variantObj.sku = await generateUniqueSku(usedSkus);
                        // }
                        // inventory: مقداردهی پیش‌فرض
                        if (!variant.inventory) {
                              variantObj.inventory = { stock: 1, price: 0 };
                        } else {
                              if (typeof variant.inventory.stock !== 'number') variantObj.inventory.stock = 1;
                              if (typeof variant.inventory.price !== 'number') variantObj.inventory.price = 0;
                        }
                        // Remove img and color_palette from variant if present
                        // delete variantObj.img;
                        // delete variantObj.color_palette;
                        productData.variants.push(variantObj);
                  }
            } else {
                  // رفتار قبلی: محصول ساده بدون variants
                  // --- SKU LOGIC ---
                  // productData.sku = nextSku;
                  throw new Error("variants not an array");
            }

            // console.log('productData:', productData)
            const product = new Product(productData);
            await product.save();
            res.status(201).json({ status: 'success', data: product, message: 'Product created successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductById = async (req: Request, res: Response) => {
      try {
            const product = await Product.findById(req.params.id);
            if (!product) return res.status(404).json({ status: 'error', error: 'Product not found' });
            // Fetch attribute values for this product
            const attributes = await getProductAttributesWithDetails(product._id as mongoose.Types.ObjectId);
            const productObj = product.toObject();
            res.json({ status: 'success', data: { ...productObj, attributes, image_ids: productObj.image_ids, img: productObj.img } });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductBySlug = async (req: Request, res: Response) => {
      try {
            const product = await Product.findOne({ slug: req.params.slug });
            if (!product) return res.status(404).json({ status: 'error', error: 'Product not found' });
            // Fetch attribute values for this product
            const attributes = await getProductAttributesWithDetails(product._id as mongoose.Types.ObjectId);
            const productObj = product.toObject();
            let category = null;
            let parentSlugs = [];
            if (productObj.category_id) {
                  // ابتدا دسته‌بندی را با id واکشی کن تا slug را بگیریم
                  const categoryDoc = await Category.findById(productObj.category_id);
                  if (categoryDoc) {
                        // حالا با slug دسته‌بندی، اطلاعات کامل و parentSlugs را بگیر
                        category = await categoriesService.getBySlug(categoryDoc.slug);
                        parentSlugs = (category as any)?.parentSlugs || [];
                  }
            }
            // حذف category_id و جایگزینی با category و parentSlugs
            const { category_id, ...rest } = productObj;
            res.json({ status: 'success', data: { ...rest, category, parentSlugs, attributes, image_ids: productObj.image_ids, img: productObj.img } });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
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
            if (!currentProduct) return res.status(404).json({ status: 'error', error: 'Product not found' });
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
                        return res.status(400).json({ status: 'error', error: 'Slug already exists' });
                  }
            }
            // --- END SLUG LOGIC ---
            const updateData: any = {
                  ...req.body,
                  slug, // always use processed slug
                  image_ids,
                  img: req.body.img,
            };
            // If variants exist, process them for new structure
            if (Array.isArray(req.body.variants) && req.body.variants.length > 0) {
                  updateData.variants = [];
                  for (const [_i, variant] of req.body.variants.entries()) {
                        let variantObj: any = { ...variant };
                        // attributes: array of { attribute_id, value }
                        if (Array.isArray(variant.attributes)) {
                              variantObj.attributes = [];
                              for (const attr of variant.attributes) {
                                    // تبدیل CategoryAttribute به ProductAttribute
                                    /*const result = await getOrCreateProductAttribute(attr.attribute_id);
                                    if (result.status !== 'success') {
                                          return res.status(400).json({ status: 'error', error: result.error });
                                    }*/
                                    variantObj.attributes.push({
                                          attribute_id: attr.attribute_id,
                                          value: attr.value,
                                    });
                              }
                        }
                        // Remove img and color_palette from variant if present
                        // delete variantObj.img;
                        // delete variantObj.color_palette;
                        updateData.variants.push(variantObj);
                  }
            }
            const product = await Product.findByIdAndUpdate(productId, updateData, { new: true });
            if (!product) return res.status(404).json({ status: 'error', error: 'Product not found' });

            // --- منطق جایگزینی کامل attributeها (replace) ---
            if (req.body.attributes && Array.isArray(req.body.attributes)) {
                  // 1. همه attributeهای قبلی را soft-delete کن
                  await ProductAttributeValue.updateMany({ product_id: product._id, deleted_at: null }, { deleted_at: new Date() });
                  // 2. فقط attributeهای جدید را اضافه یا آپدیت کن (deleted_at: null)
                  for (const attr of req.body.attributes) {
                        // تبدیل CategoryAttribute به ProductAttribute
                        /*const result = await getOrCreateProductAttribute(attr.attribute_id);
                        if (result.status !== 'success') {
                              return res.status(400).json({ status: 'error', error: result.error });
                        }*/

                        // حالا ProductAttributeValue را با ProductAttribute._id ذخیره کن
                        if (Array.isArray(attr.value)) {
                              for (const v of attr.value) {
                                    await ProductAttributeValue.findOneAndUpdate({ product_id: product._id, attribute_id: attr.attribute_id, value: v }, { value: v, deleted_at: null }, { upsert: true, new: true });
                              }
                        } else {
                              await ProductAttributeValue.findOneAndUpdate({ product_id: product._id, attribute_id: attr.attribute_id }, { value: attr.value, deleted_at: null }, { upsert: true, new: true });
                        }
                  }
            }
            // --- پایان منطق جایگزینی کامل attributeها ---

            res.json({ status: 'success', data: product, message: 'Product updated successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const deleteProduct = async (req: Request, res: Response) => {
      try {
            const product = await Product.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
            if (!product) return res.status(404).json({ status: 'error', error: 'Product not found' });
            res.json({ status: 'success', data: product, message: 'Product deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
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
            res.json({ status: 'success', ...result, items: productsWithCategory });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductsByIds = async (req: Request, res: Response) => {
      try {
            const { productIds } = req.body;

            if (!Array.isArray(productIds)) {
                  return res.status(400).json({ status: 'error', error: 'productIds must be an array' });
            }

            if (productIds.length === 0) {
                  return res.status(400).json({ status: 'error', error: 'productIds array cannot be empty' });
            }

            const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            if (validIds.length === 0) {
                  return res.status(400).json({ status: 'error', error: 'No valid product IDs provided' });
            }

            const products = await Product.find({ _id: { $in: validIds } });

            const productsWithAttributes = await Promise.all(
                  products.map(async (product: any) => {
                        const attributes = await getProductAttributesWithDetails(product._id as mongoose.Types.ObjectId);
                        const productObj = product.toObject();
                        return { ...productObj, attributes, image_ids: productObj.image_ids, img: productObj.img };
                  })
            );

            const productsMap = new Map(productsWithAttributes.map((product: any) => [product._id?.toString(), product]));

            const orderedProducts = productIds
                  .filter(id => mongoose.Types.ObjectId.isValid(id))
                  .map(id => productsMap.get(id))
                  .filter(Boolean);

            res.json({ status: 'success', data: orderedProducts });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
