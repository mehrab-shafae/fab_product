import { Types } from 'mongoose';
import { ICategory, Category } from '../models/category.model.js';
import { CategoryInput, CategoryUpdateInput } from '../types/category.types.js';
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
    // ساخت دسته‌بندی
    const category = await Category.create({
      ...data,
      parentId,
      level,
      slug,
    });
    return category;
  }

  // دریافت دسته با آیدی
  async getById(id: string, options?: { includeChildren?: boolean; depth?: number; includeAttributes?: boolean; }): Promise<ICategory | null> {
    const { includeChildren = true, depth = 2, includeAttributes = true } = options || {};
    const category = await Category.findById(id).lean();
    if (!category) return null;
    // دریافت children
    if (includeChildren && depth > 0) {
      const children = await this._getChildrenRecursive(category._id, depth - 1);
      (category as any).children = children;
    }
    // TODO: attributes را بعداً اضافه کن
    return category as ICategory;
  }

  private async _getChildrenRecursive(parentId: Types.ObjectId, depth: number): Promise<any[]> {
    if (depth < 0) return [];
    const children = await Category.find({ parentId }).lean();
    for (const child of children) {
      child.children = await this._getChildrenRecursive(child._id, depth - 1);
    }
    return children;
  }

  // دریافت دسته با اسلاگ
  async getBySlug(slug: string, options?: any): Promise<ICategory | null> {
    // TODO: MongoDB implementation
    throw new Error('Not implemented');
  }

  // دریافت درخت دسته‌بندی
  async getTree(options?: { status?: string; includeInactive?: boolean; maxDepth?: number; page?: number; limit?: number; orderBy?: string; orderDirection?: 'ASC' | 'DESC'; }): Promise<any> {
    const {
      status = 'active',
      includeInactive = false,
      maxDepth = 3,
      page = 1,
      limit = 10,
      orderBy = 'order',
      orderDirection = 'ASC',
    } = options || {};
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
      root.children = await this._getChildrenRecursive(root._id, maxDepth - 1);
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
    if (parentId) {
      const parent = await Category.findById(parentId);
      if (parent) {
        slug = `${parent.slug}/${slug}`;
      }
    }
    // اگر slug تغییر کرد، به redirects اضافه کن
    if (category.slug !== slug) {
      category.slug_redirects = category.slug_redirects || [];
      if (!category.slug_redirects.includes(category.slug)) {
        category.slug_redirects.push(category.slug);
      }
    }
    // بروزرسانی فیلدها
    Object.assign(category, data, { parentId, level, slug });
    await category.save();
    return category;
  }

  // حذف دسته‌بندی
  async delete(id: string): Promise<boolean> {
    const category = await Category.findById(id);
    if (!category) return false;
    // حذف بازگشتی زیرمجموعه‌ها
    await this._deleteRecursive(category._id);
    return true;
  }

  private async _deleteRecursive(categoryId: Types.ObjectId) {
    const children = await Category.find({ parentId: categoryId });
    for (const child of children) {
      await this._deleteRecursive(child._id);
    }
    await Category.deleteOne({ _id: categoryId });
  }

  // جستجوی ساده
  async search(params: any, options?: { page?: number; limit?: number; }): Promise<any> {
    const { page = 1, limit = 10 } = options || {};
    const query: any = {};
    if (params.name) query.name = { $regex: params.name, $options: 'i' };
    if (params.status) query.status = params.status;
    if (params.parentId) query.parentId = params.parentId;
    const total = await Category.countDocuments(query);
    const skip = (page - 1) * limit;
    const categories = await Category.find(query).skip(skip).limit(limit).lean();
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
  async bulkUpdate(categories: CategoryUpdateInput[]): Promise<any> {
    const results = [];
    for (const cat of categories) {
      if (!cat || !cat._id) continue;
      const updated = await this.update(cat._id, cat);
      results.push(updated);
    }
    return results;
  }

  // حذف گروهی
  async bulkDelete(ids: string[]): Promise<any> {
    const results = [];
    for (const id of ids) {
      const deleted = await this.delete(id);
      results.push({ id, deleted });
    }
    return results;
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
    const allDescendants = await this._getAllDescendants(category._id);
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
      const sub = await this._getAllDescendants(child._id);
      descendants.push(...sub);
    }
    return descendants;
  }

  // مسیر breadcrumb
  async getBreadcrumb(id: string): Promise<any[]> {
    const category = await Category.findById(id);
    if (!category) return [];
    const path: any[] = [];
    let current = category;
    while (current && current.parentId) {
      current = await Category.findById(current.parentId);
      if (current) path.unshift(current);
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
  async submitForApproval(categoryId: string, submittedBy: string): Promise<ICategory> {
    const category = await Category.findById(categoryId);
    if (!category) throw new Error('Category not found');
    if (category.status !== 'draft') throw new Error('Only draft categories can be submitted for approval');
    category.status = 'pending_approval';
    (category as any).submitted_by = submittedBy;
    (category as any).submitted_at = new Date();
    await category.save();
    return category;
  }
  // گردش تایید: تایید دسته
  async approveCategory(categoryId: string, approvedBy: string): Promise<ICategory> {
    const category = await Category.findById(categoryId);
    if (!category) throw new Error('Category not found');
    if (category.status !== 'pending_approval') throw new Error('Category is not pending approval');
    category.status = 'active';
    (category as any).approved_by = approvedBy;
    (category as any).approved_at = new Date();
    await category.save();
    return category;
  }
  // گردش تایید: رد دسته
  async rejectCategory(categoryId: string, rejectedBy: string, reason: string): Promise<ICategory> {
    const category = await Category.findById(categoryId);
    if (!category) throw new Error('Category not found');
    if (category.status !== 'pending_approval') throw new Error('Category is not pending approval');
    category.status = 'draft';
    (category as any).rejected_by = rejectedBy;
    (category as any).rejected_at = new Date();
    (category as any).rejection_reason = reason;
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
  async importCategories(format: string, data: any, options?: any): Promise<any> {
    let categories: any[] = [];
    if (format === 'json') {
      categories = JSON.parse(data);
    } else if (format === 'csv') {
      const [header, ...rows] = data.split(/\r?\n/);
      const fields = header.split(',');
      categories = rows.map((row: string) => {
        const values = row.split(',');
        const obj: any = {};
        fields.forEach((f, i) => { obj[f] = values[i]; });
        return obj;
      });
    } else if (format === 'xml') {
      const matches = data.match(/<category>([\s\S]*?)<\/category>/g) || [];
      categories = matches.map((cat: string) => {
        const obj: any = {};
        const fieldMatches = cat.match(/<([^>]+)>([^<]*)<\/\1>/g) || [];
        fieldMatches.forEach((f: string) => {
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
  async addAttribute(categoryId: string, attributeData: any): Promise<ICategoryAttribute> {
    const attribute = await CategoryAttribute.create({
      categoryId,
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
  async getAttributes(categoryId: string): Promise<ICategoryAttribute[]> {
    return CategoryAttribute.find({ categoryId }).sort({ order: 1 }).lean();
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
}

export const categoriesService = new CategoriesService(); 