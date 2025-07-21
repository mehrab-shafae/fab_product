import { Types } from 'mongoose';
import { ICategory, Category } from '../models/category.model.js';
import { CategoryInput, CategoryUpdateInput, CategoryApprovalInput } from '../types/category.types.js';
import { CategoryAttribute, ICategoryAttribute } from '../models/categoryAttribute.model.js';
import { CategoryAttributeOption, ICategoryAttributeOption } from '../models/categoryAttributeOption.model.js';

export class CategoriesService {
      // ایجاد دسته‌بندی جدید
      async create(data: CategoryInput): Promise<ICategory> {
            // مدیریت parentId و level
            let parentId: Types.ObjectId | null = null;
            let level = 1;
            if (data.parentId) {
                  parentId = new Types.ObjectId(data.parentId);
                  const parent = await Category.findById(parentId);
                  if (!parent) throw new Error('Parent category not found');
                  level = parent.level + 1;
            }
            // مدیریت slug یکتا
            let slug = data.slug;
            if (!slug) {
                  slug = data.name.trim().toLowerCase().replace(/\s+/g, '-');
            }
            // اگر parent دارد، slug را ترکیبی بساز
            if (parentId) {
                  const parent = await Category.findById(parentId);
                  if (parent) {
                        slug = `${parent.slug}/${slug}`;
                  }
            }
            // بررسی یکتایی slug
            const exists = await Category.findOne({ slug });
            if (exists) throw new Error('Slug already exists');

            // آماده‌سازی داده‌های متا و تصاویر
            let image_ids = data.image_ids;
            if (typeof image_ids === 'string') {
                  image_ids = [image_ids];
            } else if (!Array.isArray(image_ids)) {
                  image_ids = [];
            }
            let raw_meta_keywords: any = data.meta_keywords;
            let meta_keywords: string[];
            if (typeof raw_meta_keywords === 'string') {
                  if (raw_meta_keywords.includes(',')) {
                        meta_keywords = raw_meta_keywords
                              .split(',')
                              .map((k: string) => k.trim())
                              .filter(Boolean);
                  } else {
                        meta_keywords = [raw_meta_keywords.trim()];
                  }
            } else if (Array.isArray(raw_meta_keywords)) {
                  meta_keywords = raw_meta_keywords.map((k: any) => String(k).trim()).filter(Boolean);
            } else {
                  meta_keywords = [];
            }
            const meta_title = data.meta_title || data.name;
            const meta_description = data.meta_description || '';
            const img = data.img;
            // ساخت دسته‌بندی
            const category = await Category.create({
                  ...data,
                  parentId,
                  level,
                  slug,
                  image_ids,
                  img,
                  meta_keywords,
                  meta_title,
                  meta_description,
            });

            // اگر attribute_metadata ارسال شد، ویژگی‌ها و گزینه‌های آن را بساز
            if (data.attribute_metadata && Array.isArray(data.attribute_metadata)) {
                  for (const attr of data.attribute_metadata) {
                        const attribute = await CategoryAttribute.create({
                              categoryId: category._id,
                              name: attr.name,
                              type: attr.type,
                              required: attr.required || false,
                              order: attr.order || 0,
                        });
                        // اگر options داشت، آن‌ها را هم بساز
                        if (attr.options && Array.isArray(attr.options)) {
                              for (const opt of attr.options) {
                                    await CategoryAttributeOption.create({
                                          attributeId: attribute._id,
                                          value: opt.value,
                                          order: opt.order || 0,
                                    });
                              }
                        }
                  }
            }
            return category;
      }

      // دریافت دسته با آیدی
      async getById(id: string, options?: { includeChildren?: boolean; depth?: number; includeAttributes?: boolean }): Promise<ICategory | null> {
            const { includeChildren = true, depth = 2, includeAttributes = true } = options || {};
            const category = await Category.findById(id).lean();
            if (!category) return null;
            // دریافت children
            if (includeChildren && depth > 0) {
                  const categoryIdStr = typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function' ? category._id.toString() : String(category._id);
                  const children = await this._getChildrenRecursive(new Types.ObjectId(categoryIdStr), depth - 1);
                  (category as any).children = children;
            }
            // دریافت attributes
            if (includeAttributes) {
                  const attributes = await this.getAttributes(category._id.toString());
                  (category as any).attributes = attributes;
            }
            return category as ICategory;
      }

      private async _getChildrenRecursive(parentId: Types.ObjectId, depth: number): Promise<any[]> {
            if (depth < 0) return [];
            const children = await Category.find({ parentId }).lean();
            for (const child of children) {
                  // Ensure child._id is a valid ObjectId
                  const childIdStr = typeof child._id === 'object' && child._id !== null && typeof child._id.toString === 'function' ? child._id.toString() : String(child._id);
                  (child as any).children = await this._getChildrenRecursive(new Types.ObjectId(childIdStr), depth - 1);
            }
            return children;
      }

      // دریافت دسته با اسلاگ
      async getBySlug(slug: string, options?: any): Promise<ICategory | null> {
            const { includeChildren = true, depth = 2, includeAttributes = true } = options || {};

            // ابتدا در slug اصلی جستجو کن
            let category = await Category.findOne({ slug }).lean();

            // اگر پیدا نشد، در redirects جستجو کن
            if (!category) {
                  category = await Category.findOne({ slug_redirects: slug }).lean();
            }

            if (!category) return null;

            // دریافت children
            if (includeChildren && depth > 0) {
                  const categoryIdStr = typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function' ? category._id.toString() : String(category._id);
                  const children = await this._getChildrenRecursive(new Types.ObjectId(categoryIdStr), depth - 1);
                  (category as any).children = children;
            }

            if (includeAttributes) {
                  const attributes = await this.getAttributes(category._id.toString());
                  (category as any).attributes = attributes;
            }

            return category as ICategory;
      }

      // دریافت درخت دسته‌بندی
      async getTree(options?: { status?: string; includeInactive?: boolean; maxDepth?: number; page?: number; limit?: number; orderBy?: string; orderDirection?: 'ASC' | 'DESC' }): Promise<any> {
            const { status = 'active', includeInactive = false, maxDepth = 3, page = 1, limit = 10, orderBy = 'order', orderDirection = 'ASC' } = options || {};
            const where: any = includeInactive ? {} : { status };
            where.parentId = null;
            const total = await Category.countDocuments(where);
            const skip = (page - 1) * limit;
            const roots = await Category.find(where)
                  .sort({ [orderBy]: orderDirection === 'ASC' ? 1 : -1 })
                  .skip(skip)
                  .limit(limit)
                  .lean();
            // دریافت children به صورت بازگشتی
            for (const root of roots) {
                  const rootIdStr = typeof root._id === 'object' && root._id !== null && typeof root._id.toString === 'function' ? root._id.toString() : String(root._id);
                  (root as any).children = await this._getChildrenRecursive(new Types.ObjectId(rootIdStr), maxDepth - 1);
            }
            return {
                  data: roots,
                  pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                  },
            };
      }

      // ویرایش دسته‌بندی
      async update(id: string, data: CategoryUpdateInput): Promise<ICategory | null> {
            const category = await Category.findById(id);
            if (!category) return null;
            // مدیریت parentId و level
            let parentId: Types.ObjectId | null = null;
            let level = 1;
            if (data.parentId) {
                  parentId = new Types.ObjectId(data.parentId);
                  const parent = await Category.findById(parentId);
                  if (!parent) throw new Error('Parent category not found');
                  level = parent.level + 1;
            }
            // مدیریت slug یکتا
            let slug = data.slug || category.slug;
            if (data.name && !data.slug) {
                  slug = data.name.trim().toLowerCase().replace(/\s+/g, '-');
            }
            // if (parentId) {
            //       const parent = await Category.findById(parentId);
            //       if (parent) {
            //             slug = `${parent.slug}/${slug}`;
            //       }
            // }
            // اگر slug تغییر کرد، به redirects اضافه کن
            if (category.slug !== slug) {
                  category.slug_redirects = category.slug_redirects || [];
                  if (!category.slug_redirects.includes(category.slug)) {
                        category.slug_redirects.push(category.slug);
                  }
            }
            // بروزرسانی فیلدهای جدید
            let image_ids = data.image_ids;
            if (typeof image_ids === 'string') {
                  image_ids = [image_ids];
            } else if (!Array.isArray(image_ids)) {
                  image_ids = undefined;
            }
            let raw_meta_keywords: any = data.meta_keywords;
            let meta_keywords: string[] | undefined;
            if (typeof raw_meta_keywords === 'string') {
                  if (raw_meta_keywords.includes(',')) {
                        meta_keywords = raw_meta_keywords
                              .split(',')
                              .map((k: string) => k.trim())
                              .filter(Boolean);
                  } else {
                        meta_keywords = [raw_meta_keywords.trim()];
                  }
            } else if (Array.isArray(raw_meta_keywords)) {
                  meta_keywords = raw_meta_keywords.map((k: any) => String(k).trim()).filter(Boolean);
            } else {
                  meta_keywords = undefined;
            }
            if (image_ids) category.image_ids = image_ids;
            if (meta_keywords !== undefined) {
                  category.meta_keywords = meta_keywords;
            } else {
                  category.meta_keywords = [];
            }
            if (data.meta_title) category.meta_title = data.meta_title;
            if (data.meta_description) category.meta_description = data.meta_description;
            if (data.img && typeof data.img === 'string' && data.img.trim()) {
                  category.img = data.img;
            }
            // بروزرسانی سایر فیلدها
            Object.assign(category, data, { parentId, level, slug });
            await category.save();
            // اگر attribute_metadata ارسال شد، ویژگی‌ها و گزینه‌های آن را مدیریت کن
            if (data.attribute_metadata && Array.isArray(data.attribute_metadata)) {
                  // 1. لیست attributeهای فعلی این دسته را بگیر
                  const currentAttributes = await CategoryAttribute.find({ categoryId: category._id });
                  // 2. لیست idهای attributeهای جدید را از ورودی استخراج کن
                  // توجه: فیلد id ممکن است وجود نداشته باشد، پس از _id استفاده می‌کنیم
                  const newAttrIds = data.attribute_metadata.filter(a => (a as any)._id).map(a => String((a as any)._id));
                  // 3. attributeهایی که در دیتابیس هستند اما در ورودی نیستند را حذف کن
                  for (const attr of currentAttributes) {
                        const attrId = typeof attr._id === 'object' && attr._id !== null && typeof attr._id.toString === 'function' ? attr._id.toString() : String(attr._id);
                        if (!newAttrIds.includes(attrId)) {
                              // حذف attribute و optionهایش
                              await CategoryAttributeOption.deleteMany({ attributeId: attr._id });
                              await CategoryAttribute.findByIdAndDelete(attr._id);
                        }
                  }
                  // 4. حالا attributeهای جدید را ویرایش/ایجاد کن
                  for (const attr of data.attribute_metadata) {
                        let attribute;
                        if ((attr as any).id) {
                              attribute = await CategoryAttribute.findById((attr as any).id);
                              if (attribute) {
                                    attribute.name = attr.name;
                                    attribute.type = attr.type;
                                    attribute.required = attr.required || false;
                                    attribute.order = attr.order || 0;
                                    await attribute.save();
                                    // مدیریت options
                                    // لیست optionهای فعلی این attribute
                                    const currentOptions = await CategoryAttributeOption.find({ attributeId: attribute._id });
                                    // توجه: فیلد id ممکن است وجود نداشته باشد، پس از _id استفاده می‌کنیم
                                    const newOptIds = (attr.options || []).filter(o => (o as any)._id).map(o => String((o as any)._id));
                                    // حذف optionهایی که دیگر در ورودی نیستند
                                    for (const opt of currentOptions) {
                                          const optId = typeof opt._id === 'object' && opt._id !== null && typeof opt._id.toString === 'function' ? opt._id.toString() : String(opt._id);
                                          if (!newOptIds.includes(optId)) {
                                                await CategoryAttributeOption.findByIdAndDelete(opt._id);
                                          }
                                    }
                                    // ویرایش/ایجاد optionها
                                    if (attr.options && Array.isArray(attr.options)) {
                                          for (const opt of attr.options) {
                                                let option;
                                                if ((opt as any).id) {
                                                      option = await CategoryAttributeOption.findById((opt as any).id);
                                                      if (option) {
                                                            option.value = opt.value;
                                                            option.order = opt.order || 0;
                                                            await option.save();
                                                      }
                                                } else {
                                                      await CategoryAttributeOption.create({
                                                            attributeId: attribute._id,
                                                            value: opt.value,
                                                            order: opt.order || 0,
                                                      });
                                                }
                                          }
                                    }
                              }
                        } else {
                              attribute = await CategoryAttribute.create({
                                    categoryId: category._id,
                                    name: attr.name,
                                    type: attr.type,
                                    required: attr.required || false,
                                    order: attr.order || 0,
                              });
                              if (attr.options && Array.isArray(attr.options)) {
                                    for (const opt of attr.options) {
                                          await CategoryAttributeOption.create({
                                                attributeId: attribute._id,
                                                value: opt.value,
                                                order: opt.order || 0,
                                          });
                                    }
                              }
                        }
                  }
            }
            return category;
      }

      // حذف دسته‌بندی
      async delete(id: string): Promise<boolean> {
            const category = await Category.findById(id);
            if (!category) return false;
            // حذف بازگشتی زیرمجموعه‌ها
            const categoryIdStr = typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function' ? category._id.toString() : String(category._id);
            await this._deleteRecursive(new Types.ObjectId(categoryIdStr));
            return true;
      }

      private async _deleteRecursive(categoryId: Types.ObjectId) {
            const children = await Category.find({ parentId: categoryId });
            for (const child of children) {
                  const childIdStr = typeof child._id === 'object' && child._id !== null && typeof child._id.toString === 'function' ? child._id.toString() : String(child._id);
                  await this._deleteRecursive(new Types.ObjectId(childIdStr));
            }
            await Category.deleteOne({ _id: categoryId });
      }

      // جستجوی پیشرفته با صفحه‌بندی و فیلتر و مرتب‌سازی
      async search(params: any, options?: { page?: number; limit?: number; sort?: any }): Promise<any> {
            const { page = 1, limit = 10, sort = { createdAt: -1 } } = options || {};
            const query: any = {};
            // فیلترها
            if (params.name) query.name = { $regex: params.name, $options: 'i' };
            if (params.status) query.status = params.status;
            if (params.parentId) query.parentId = params.parentId;
            if (params.slug) query.slug = params.slug;
            // جستجو
            if (params.search) {
                  query.$or = [{ name: { $regex: params.search, $options: 'i' } }, { meta_title: { $regex: params.search, $options: 'i' } }, { meta_description: { $regex: params.search, $options: 'i' } }];
            }
            const total = await Category.countDocuments(query);
            const skip = (page - 1) * limit;
            const categories = await Category.find(query).sort(sort).skip(skip).limit(limit).lean();
            return {
                  data: categories,
                  pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                  },
            };
      }

      // جستجوی پیشرفته
      async advancedSearch(params: any, options?: { page?: number; limit?: number; sort?: any }): Promise<any> {
            const { page = 1, limit = 10, sort = { createdAt: -1 } } = options || {};
            const query: any = {};
            if (params.name) query.name = { $regex: params.name, $options: 'i' };
            if (params.status) query.status = params.status;
            if (params.level) query.level = params.level;
            if (params.parentId) query.parentId = params.parentId;
            if (params.slug) query.slug = params.slug;
            const total = await Category.countDocuments(query);
            const skip = (page - 1) * limit;
            const categories = await Category.find(query).sort(sort).skip(skip).limit(limit).lean();
            return {
                  data: categories,
                  pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                  },
            };
      }

      // بروزرسانی گروهی
      async bulkUpdate(categories: (CategoryUpdateInput & { _id: string })[]): Promise<any> {
            const results = [];
            let success = 0;
            let failed = 0;
            for (const cat of categories) {
                  if (!cat || !cat._id) continue;
                  try {
                        const updated = await this.update(cat._id, cat);
                        if (updated) {
                              results.push({ id: cat._id, success: true });
                              success++;
                        } else {
                              results.push({ id: cat._id, success: false });
                              failed++;
                        }
                  } catch (e) {
                        results.push({ id: cat._id, success: false, error: (e as Error).message });
                        failed++;
                  }
            }
            return { total: categories.length, success, failed, results };
      }

      // حذف گروهی
      async bulkDelete(ids: string[]): Promise<any> {
            const results = [];
            let success = 0;
            let failed = 0;
            for (const id of ids) {
                  try {
                        const deleted = await this.delete(id);
                        if (deleted) {
                              results.push({ id, deleted: true });
                              success++;
                        } else {
                              results.push({ id, deleted: false });
                              failed++;
                        }
                  } catch (e) {
                        results.push({ id, deleted: false, error: (e as Error).message });
                        failed++;
                  }
            }
            return { total: ids.length, success, failed, results };
      }

      // تغییر ترتیب
      async reorderCategories(orderedIds: string[]): Promise<any> {
            for (let i = 0; i < orderedIds.length; i++) {
                  await Category.findByIdAndUpdate(orderedIds[i], { order: i });
            }
            return { success: true };
      }

      // آمار دسته
      async getCategoryStats(id: string): Promise<any> {
            const category = await Category.findById(id);
            if (!category) return null;
            // تعداد زیرمجموعه‌ها
            const subcategoryCount = await Category.countDocuments({ parentId: category._id });
            // تعداد کل زیرمجموعه‌ها (بازگشتی)
            const categoryIdStr = typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function' ? category._id.toString() : String(category._id);
            const allDescendants = await this._getAllDescendants(new Types.ObjectId(categoryIdStr));
            // تعداد محصولات (در صورت وجود مدل Product)
            // const productCount = await Product.countDocuments({ categoryId: category._id });
            return {
                  category: {
                        id: category._id,
                        name: category.name,
                        slug: category.slug,
                  },
                  stats: {
                        subcategories: subcategoryCount,
                        totalDescendants: allDescendants.length,
                        // products: productCount,
                        level: category.level,
                  },
            };
      }

      private async _getAllDescendants(parentId: Types.ObjectId): Promise<any[]> {
            const descendants = [];
            const children = await Category.find({ parentId });
            for (const child of children) {
                  descendants.push(child);
                  const childIdStr = typeof child._id === 'object' && child._id !== null && typeof child._id.toString === 'function' ? child._id.toString() : String(child._id);
                  const sub = await this._getAllDescendants(new Types.ObjectId(childIdStr));
                  descendants.push(...sub);
            }
            return descendants;
      }

      // مسیر breadcrumb
      async getBreadcrumb(id: string): Promise<any[]> {
            const category = await Category.findById(id);
            if (!category) return [];
            const path: any[] = [];
            let current: typeof category | null = category;
            while (current && current.parentId) {
                  const next: typeof category | null = await Category.findById(current.parentId);
                  if (!next) break;
                  path.unshift(next);
                  current = next;
            }
            path.push(category);
            return path;
      }

      // دریافت دسته‌های ویژه
      async getFeaturedCategories(limit: number = 10): Promise<ICategory[]> {
            return Category.find({ is_featured: true }).limit(limit).lean();
      }

      // کپی دسته
      async cloneCategory(categoryId: string, newName: string, newParentId?: string): Promise<ICategory> {
            const original = await Category.findById(categoryId);
            if (!original) throw new Error('Category not found');
            let parentId: Types.ObjectId | null = null;
            let level = 1;
            if (newParentId) {
                  parentId = new Types.ObjectId(newParentId);
                  const parent = await Category.findById(parentId);
                  if (!parent) throw new Error('Parent category not found');
                  level = parent.level + 1;
            }
            let slug = newName.trim().toLowerCase().replace(/\s+/g, '-');
            if (parentId) {
                  const parent = await Category.findById(parentId);
                  if (parent) slug = `${parent.slug}/${slug}`;
            }
            const exists = await Category.findOne({ slug });
            if (exists) throw new Error('Slug already exists');
            const clone = await Category.create({
                  ...original.toObject(),
                  _id: undefined,
                  name: newName,
                  parentId,
                  level,
                  slug,
                  status: 'draft',
                  is_featured: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
            });
            return clone;
      }

      // دریافت قالب دسته
      async getCategoryTemplate(templateId: string): Promise<ICategory | null> {
            return Category.findById(templateId).lean();
      }

      // ایجاد از قالب
      async createFromTemplate(templateId: string, data: CategoryInput): Promise<ICategory> {
            const template = await this.getCategoryTemplate(templateId);
            if (!template) throw new Error('Template not found');
            let parentId: Types.ObjectId | null = null;
            let level = 1;
            if (data.parentId) {
                  parentId = new Types.ObjectId(data.parentId);
                  const parent = await Category.findById(parentId);
                  if (!parent) throw new Error('Parent category not found');
                  level = parent.level + 1;
            }
            let slug = data.slug || data.name.trim().toLowerCase().replace(/\s+/g, '-');
            if (parentId) {
                  const parent = await Category.findById(parentId);
                  if (parent) slug = `${parent.slug}/${slug}`;
            }
            const exists = await Category.findOne({ slug });
            if (exists) throw new Error('Slug already exists');
            const category = await Category.create({
                  ...template,
                  ...data,
                  _id: undefined,
                  parentId,
                  level,
                  slug,
                  status: data.status || 'draft',
                  is_featured: data.is_featured || false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
            });
            return category;
      }

      // مدیریت redirects اسلاگ
      async addSlugRedirect(categoryId: string, oldSlug: string): Promise<ICategory> {
            const category = await Category.findById(categoryId);
            if (!category) throw new Error('Category not found');
            category.slug_redirects = category.slug_redirects || [];
            if (!category.slug_redirects.includes(oldSlug)) {
                  category.slug_redirects.push(oldSlug);
                  await category.save();
            }
            return category;
      }
      async removeSlugRedirect(categoryId: string, oldSlug: string): Promise<ICategory> {
            const category = await Category.findById(categoryId);
            if (!category) throw new Error('Category not found');
            category.slug_redirects = (category.slug_redirects || []).filter((s: string) => s !== oldSlug);
            await category.save();
            return category;
      }
      async getSlugRedirects(categoryId: string): Promise<string[]> {
            const category = await Category.findById(categoryId).lean();
            if (!category) throw new Error('Category not found');
            return category.slug_redirects || [];
      }

      // گردش تایید: ارسال برای تایید
      async submitForApproval(categoryId: string, data: CategoryApprovalInput): Promise<ICategory> {
            const category = await Category.findById(categoryId);
            if (!category) throw new Error('Category not found');

            if (category.approval_status === 'pending') {
                  throw new Error('Category is already pending approval');
            }

            category.approval_status = 'pending';
            category.submitted_by = data.submittedBy;
            category.submitted_at = new Date();
            category.approved_by = undefined;
            category.rejected_by = undefined;
            category.rejection_reason = undefined;
            category.approved_at = undefined;
            category.rejected_at = undefined;

            await category.save();
            return category;
      }

      // گردش تایید: تایید دسته
      async approveCategory(categoryId: string, data: CategoryApprovalInput): Promise<ICategory> {
            const category = await Category.findById(categoryId);
            if (!category) throw new Error('Category not found');

            if (category.approval_status !== 'pending') {
                  throw new Error('Category is not pending approval');
            }

            category.approval_status = 'approved';
            category.approved_by = data.approvedBy;
            category.approved_at = new Date();
            category.status = 'active';

            await category.save();
            return category;
      }

      // گردش تایید: رد دسته
      async rejectCategory(categoryId: string, data: CategoryApprovalInput): Promise<ICategory> {
            const category = await Category.findById(categoryId);
            if (!category) throw new Error('Category not found');

            if (category.approval_status !== 'pending') {
                  throw new Error('Category is not pending approval');
            }

            if (!data.rejectionReason || data.rejectionReason.trim().length === 0) {
                  throw new Error('Rejection reason is required');
            }

            category.approval_status = 'rejected';
            category.rejected_by = data.rejectedBy;
            category.rejection_reason = data.rejectionReason.trim();
            category.rejected_at = new Date();
            category.status = 'inactive';

            await category.save();
            return category;
      }

      // خروجی گرفتن
      async exportCategories(format: string, options?: { includeSubcategories?: boolean }): Promise<any> {
            const { includeSubcategories = true } = options || {};
            let categories: any[];
            if (includeSubcategories) {
                  categories = await Category.find().lean();
            } else {
                  categories = await Category.find({ parentId: null }).lean();
            }
            if (format === 'json') {
                  return JSON.stringify(categories, null, 2);
            } else if (format === 'csv') {
                  const fields = Object.keys(categories[0] || {});
                  const csv = [fields.join(',')].concat(categories.map(cat => fields.map(f => JSON.stringify(cat[f] ?? '')).join(','))).join('\n');
                  return csv;
            } else if (format === 'xml') {
                  let xml = '<categories>';
                  for (const cat of categories) {
                        xml += '<category>';
                        for (const key in cat) {
                              xml += `<${key}>${cat[key]}</${key}>`;
                        }
                        xml += '</category>';
                  }
                  xml += '</categories>';
                  return xml;
            } else {
                  throw new Error('Unsupported export format');
            }
      }

      // ورودی گرفتن
      async importCategories(format: string, data: any, _options?: any): Promise<any> {
            let categories: any[] = [];
            if (format === 'json') {
                  categories = JSON.parse(data);
            } else if (format === 'csv') {
                  const [header, ...rows] = data.split(/\r?\n/);
                  const fields = header.split(',');
                  categories = rows.map((row: string) => {
                        const values = row.split(',');
                        const obj: any = {};
                        fields.forEach((f: string, i: number) => {
                              obj[f] = values[i];
                        });
                        return obj;
                  });
            } else if (format === 'xml') {
                  const matches = data.match(/<category>([\s\S]*?)<\/category>/g) || [];
                  categories = matches.map((cat: string) => {
                        const obj: any = {};
                        const fieldMatches = cat.match(/<([^>]+)>([^<]*)<\/\1>/g) || [];
                        fieldMatches.forEach((f: string, _i: number) => {
                              const [, key, value] = f.match(/<([^>]+)>([^<]*)<\/\1>/) || [];
                              obj[key] = value;
                        });
                        return obj;
                  });
            } else {
                  throw new Error('Unsupported import format');
            }
            // ذخیره در دیتابیس
            const results = [];
            for (const cat of categories) {
                  const created = await Category.create(cat);
                  results.push(created);
            }
            return results;
      }

      // مدیریت attribute و optionها (reference)
      async addAttribute(categoryId: string | Types.ObjectId, attributeData: any): Promise<ICategoryAttribute> {
            // Debug log for incoming categoryId
            console.log('addAttribute - received categoryId:', categoryId, 'type:', typeof categoryId);
            let validCategoryId: Types.ObjectId | undefined;
            if (categoryId instanceof Types.ObjectId) {
                  validCategoryId = categoryId;
            } else if (typeof categoryId === 'string' && Types.ObjectId.isValid(categoryId)) {
                  validCategoryId = new Types.ObjectId(categoryId);
            } else {
                  throw new Error(`Invalid categoryId: ${categoryId}`);
            }
            // Only allow valid types
            const allowedTypes = ['string', 'number', 'enum'];
            if (!allowedTypes.includes(attributeData.type)) {
                  throw new Error(`type: '${attributeData.type}' is not a valid enum value for path 'type'. Allowed: ${allowedTypes.join(', ')}`);
            }
            const attribute = await CategoryAttribute.create({
                  categoryId: validCategoryId,
                  ...attributeData,
            });
            return attribute;
      }
      async updateAttribute(attributeId: string, attributeData: any): Promise<ICategoryAttribute | null> {
            return CategoryAttribute.findByIdAndUpdate(attributeId, attributeData, { new: true });
      }
      async deleteAttribute(attributeId: string): Promise<boolean> {
            await CategoryAttributeOption.deleteMany({ attributeId });
            const res = await CategoryAttribute.findByIdAndDelete(attributeId);
            return !!res;
      }
      async getAttributes(categoryId: string): Promise<any[]> {
            const objectId = typeof categoryId === 'string' && Types.ObjectId.isValid(categoryId) ? new Types.ObjectId(categoryId) : categoryId;
            const attributes = await CategoryAttribute.find({ categoryId: objectId }).sort({ order: 1 }).lean();
            const attributesWithOptions = await Promise.all(
                  attributes.map(async attr => {
                        const options = await this.getAttributeOptions(attr._id.toString());
                        return { ...attr, options };
                  })
            );
            return attributesWithOptions;
      }
      async addAttributeOption(attributeId: string, value: string, order: number = 0): Promise<ICategoryAttributeOption> {
            return CategoryAttributeOption.create({ attributeId, value, order });
      }
      async updateAttributeOption(optionId: string, value: string, order: number): Promise<ICategoryAttributeOption | null> {
            return CategoryAttributeOption.findByIdAndUpdate(optionId, { value, order }, { new: true });
      }
      async deleteAttributeOption(optionId: string): Promise<boolean> {
            const res = await CategoryAttributeOption.findByIdAndDelete(optionId);
            return !!res;
      }
      async getAttributeOptions(attributeId: string): Promise<ICategoryAttributeOption[]> {
            return CategoryAttributeOption.find({ attributeId }).sort({ order: 1 }).lean();
      }

      // دریافت تمام زیرمجموعه‌های یک دسته (بازگشتی)
      async getCategoryDescendants(id: string): Promise<ICategory[]> {
            const descendants: ICategory[] = [];
            const findDescendants = async (parentId: string) => {
                  const children = await Category.find({ parentId }).lean();
                  for (const child of children) {
                        descendants.push(child as ICategory);
                        await findDescendants(child._id.toString());
                  }
            };
            await findDescendants(id);
            return descendants;
      }

      // دریافت والدهای یک دسته (تا ریشه)
      async getCategoryAncestors(id: string): Promise<ICategory[]> {
            const ancestors: ICategory[] = [];
            let current = await Category.findById(id).lean();
            while (current && current.parentId) {
                  const parent = await Category.findById(current.parentId).lean();
                  if (parent) ancestors.unshift(parent as ICategory);
                  current = parent;
            }
            return ancestors;
      }

      // دریافت دسته‌های هم‌سطح (siblings)
      async getCategorySiblings(id: string): Promise<ICategory[]> {
            const category = await Category.findById(id).lean();
            if (!category) return [];
            return Category.find({ parentId: category.parentId, _id: { $ne: category._id } }).lean();
      }

      // --- Analytics & Reports ---
      async getCategoryAnalytics(id: string, options?: { dateRange?: string; metrics?: string[]; groupBy?: string; includeSubcategories?: boolean; includeProducts?: boolean; includeAttributes?: boolean }): Promise<any> {
            const category = await Category.findById(id);
            if (!category) throw new Error('Category not found');
            // Handle includeSubcategories
            const descendants = options?.includeSubcategories !== false ? await this.getCategoryDescendants(id) : [];
            // Handle includeAttributes
            const attributes = options?.includeAttributes !== false ? await this.getAttributes(id) : [];
            let totalOptions = 0;
            for (const attr of attributes) {
                  const opts = await this.getAttributeOptions((attr as any)._id.toString());
                  totalOptions += opts.length;
            }
            // Filter by metrics if provided
            const stats: any = {};
            if (!options?.metrics || options.metrics.includes('subcategories')) {
                  stats.subcategories = descendants.length;
            }
            if (!options?.metrics || options.metrics.includes('attributes')) {
                  stats.attributes = attributes.length;
            }
            if (!options?.metrics || options.metrics.includes('options')) {
                  stats.options = totalOptions;
            }
            // TODO: Use dateRange, groupBy for advanced analytics (aggregation, filtering by createdAt, etc.)
            return {
                  category: { id: category._id, name: category.name, slug: category.slug },
                  stats,
            };
      }

      async getCategoryPerformance(id: string, options?: { dateRange?: string; metrics?: string[] }): Promise<any> {
            const category = await Category.findById(id);
            if (!category) throw new Error('Category not found');
            const descendants = await this.getCategoryDescendants(id);
            const attributes = await this.getAttributes(id);
            const performance: any = {};
            if (!options?.metrics || options.metrics.includes('totalDescendants')) {
                  performance.totalDescendants = descendants.length;
            }
            if (!options?.metrics || options.metrics.includes('level')) {
                  performance.level = category.level;
            }
            if (!options?.metrics || options.metrics.includes('attributes')) {
                  performance.attributes = attributes.length;
            }
            // TODO: Use dateRange for time-based performance metrics
            return {
                  category: { id: category._id, name: category.name, slug: category.slug },
                  performance,
            };
      }

      async getCategoryGrowth(id: string, options?: { periods?: string[]; metrics?: string[] }): Promise<any> {
            // For now, just return totalDescendants; in future, use periods/metrics for time-based growth
            const descendants = await this.getCategoryDescendants(id);
            const growth: any = {};
            if (!options?.metrics || options.metrics.includes('totalDescendants')) {
                  growth.totalDescendants = descendants.length;
            }
            // TODO: Use periods for time-based growth analysis (e.g., count new descendants in each period)
            return { growth };
      }

      async getComparisonReport(categoryIds: string[], options?: { dateRange?: string; metrics?: string[] }): Promise<any> {
            const result = [];
            for (const id of categoryIds) {
                  const category = await Category.findById(id);
                  if (!category) continue;
                  const descendants = await this.getCategoryDescendants(id);
                  const attributes = await this.getAttributes(id);
                  const entry: any = { id: category._id, name: category.name };
                  if (!options?.metrics || options.metrics.includes('descendants')) {
                        entry.descendants = descendants.length;
                  }
                  if (!options?.metrics || options.metrics.includes('attributes')) {
                        entry.attributes = attributes.length;
                  }
                  // TODO: Use dateRange for time-based comparison
                  result.push(entry);
            }
            return result;
      }

      async getHierarchyAnalytics(rootId?: string): Promise<any> {
            // آمار سلسله‌مراتبی: تعداد کل دسته‌ها و زیرمجموعه‌ها از یک ریشه
            const root = rootId ? await Category.findById(rootId).lean() : null;
            let all: any[] = [];
            if (root) {
                  // Ensure root._id is a string
                  const rootIdStr = typeof root._id === 'string' ? root._id : (root._id?.toString?.() ?? '');
                  all = await this.getCategoryDescendants(rootIdStr);
            } else {
                  all = await Category.find().lean();
            }
            return {
                  root: root ? { id: root._id, name: root.name } : 'all',
                  totalCategories: all.length,
            };
      }

      async getLegacyTree(): Promise<any> {
            // بازگشت ساختار درختی قدیمی (parent/children)
            const buildTree = async (parentId: string | null = null) => {
                  const nodes = await Category.find(parentId ? { parentId } : { parentId: null }).lean();
                  for (const node of nodes) {
                        (node as any).children = await buildTree(node._id.toString());
                  }
                  return nodes;
            };
            return buildTree();
      }

      async getCategoryInsights(id: string, options?: { metrics?: string[] }): Promise<any> {
            const attributes = await this.getAttributes(id);
            let maxOptions = 0;
            let maxAttr = null;
            for (const attr of attributes) {
                  const opts = await this.getAttributeOptions((attr as any)._id.toString());
                  if (opts.length > maxOptions) {
                        maxOptions = opts.length;
                        maxAttr = attr.name;
                  }
            }
            const insights: any = {};
            if (!options?.metrics || options.metrics.includes('mostOptionsAttribute')) {
                  insights.mostOptionsAttribute = maxAttr;
            }
            if (!options?.metrics || options.metrics.includes('maxOptions')) {
                  insights.maxOptions = maxOptions;
            }
            if (!options?.metrics || options.metrics.includes('totalAttributes')) {
                  insights.totalAttributes = attributes.length;
            }
            // TODO: Add more advanced insights based on metrics
            return { insights };
      }

      // دریافت ویژگی‌های دسته با وراثت از والدها
      async getAllAttributesWithInheritance(categoryId: string): Promise<any[]> {
            const attributes: any[] = [];
            const seenNames = new Set<string>();
            let currentCategory = await Category.findById(categoryId);
            while (currentCategory) {
                  const objectId = typeof currentCategory._id === 'string' && Types.ObjectId.isValid(currentCategory._id) ? new Types.ObjectId(currentCategory._id) : currentCategory._id;
                  const attrs = await CategoryAttribute.find({ categoryId: objectId }).lean();
                  for (const a of attrs) {
                        if (!seenNames.has(a.name)) {
                              const currentCategoryIdStr = typeof currentCategory._id === 'string' ? currentCategory._id : currentCategory._id?.toString?.();
                              const options = await this.getAttributeOptions(a._id.toString());
                              attributes.push({ ...a, inherited: currentCategoryIdStr !== categoryId, options });
                              seenNames.add(a.name);
                        }
                  }
                  if (!currentCategory.parentId) break;
                  currentCategory = await Category.findById(currentCategory.parentId);
            }
            return attributes;
      }

      // دریافت ویژگی‌ها با صفحه‌بندی و فیلتر و جستجو
      async getAttributesAdvanced(params: any, options?: { page?: number; limit?: number; sort?: any }): Promise<any> {
            const { page = 1, limit = 10, sort = { order: 1 } } = options || {};
            const query: any = {};
            if (params.categoryId) query.categoryId = params.categoryId;
            if (params.name) query.name = { $regex: params.name, $options: 'i' };
            if (params.type) query.type = params.type;
            if (params.search) {
                  query.$or = [{ name: { $regex: params.search, $options: 'i' } }];
            }
            const total = await CategoryAttribute.countDocuments(query);
            const skip = (page - 1) * limit;
            const attributes = await CategoryAttribute.find(query).sort(sort).skip(skip).limit(limit).lean();
            return {
                  data: attributes,
                  pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                  },
            };
      }

      // بروزرسانی گروهی ویژگی‌ها
      async bulkUpdateAttributes(attributes: (Partial<ICategoryAttribute> & { _id: string })[]): Promise<any> {
            const results = [];
            let success = 0;
            let failed = 0;
            for (const attr of attributes) {
                  if (!attr || !attr._id) continue;
                  try {
                        const updated = await CategoryAttribute.findByIdAndUpdate(attr._id, attr, { new: true });
                        if (updated) {
                              results.push({ id: attr._id, success: true });
                              success++;
                        } else {
                              results.push({ id: attr._id, success: false });
                              failed++;
                        }
                  } catch (e) {
                        results.push({ id: attr._id, success: false, error: (e as Error).message });
                        failed++;
                  }
            }
            return { total: attributes.length, success, failed, results };
      }

      // حذف گروهی ویژگی‌ها
      async bulkDeleteAttributes(ids: string[]): Promise<any> {
            const results = [];
            let success = 0;
            let failed = 0;
            for (const id of ids) {
                  try {
                        const deleted = await CategoryAttribute.findByIdAndDelete(id);
                        if (deleted) {
                              results.push({ id, deleted: true });
                              success++;
                        } else {
                              results.push({ id, deleted: false });
                              failed++;
                        }
                  } catch (e) {
                        results.push({ id, deleted: false, error: (e as Error).message });
                        failed++;
                  }
            }
            return { total: ids.length, success, failed, results };
      }
}

export const categoriesService = new CategoriesService();
