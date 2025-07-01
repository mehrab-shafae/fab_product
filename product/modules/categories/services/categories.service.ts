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
      const categoryIdStr =
        typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function'
          ? category._id.toString()
          : String(category._id);
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
      const childIdStr =
        typeof child._id === 'object' && child._id !== null && typeof child._id.toString === 'function'
          ? child._id.toString()
          : String(child._id);
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
      const categoryIdStr =
        typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function'
          ? category._id.toString()
          : String(category._id);
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
      const rootIdStr =
        typeof root._id === 'object' && root._id !== null && typeof root._id.toString === 'function'
          ? root._id.toString()
          : String(root._id);
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
    const categoryIdStr =
      typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function'
        ? category._id.toString()
        : String(category._id);
    await this._deleteRecursive(new Types.ObjectId(categoryIdStr));
    return true;
  }

  private async _deleteRecursive(categoryId: Types.ObjectId) {
    const children = await Category.find({ parentId: categoryId });
    for (const child of children) {
      const childIdStr =
        typeof child._id === 'object' && child._id !== null && typeof child._id.toString === 'function'
          ? child._id.toString()
          : String(child._id);
      await this._deleteRecursive(new Types.ObjectId(childIdStr));
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
  async bulkUpdate(categories: (CategoryUpdateInput & { _id: string })[]): Promise<any> {
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
    const categoryIdStr =
      typeof category._id === 'object' && category._id !== null && typeof category._id.toString === 'function'
        ? category._id.toString()
        : String(category._id);
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
      const childIdStr =
        typeof child._id === 'object' && child._id !== null && typeof child._id.toString === 'function'
          ? child._id.toString()
          : String(child._id);
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
        fields.forEach((f: string, i: number) => { obj[f] = values[i]; });
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
  async getCategoryAnalytics(id: string, _options?: any): Promise<any> {
    // آمار پایه: تعداد زیرمجموعه، تعداد attribute، تعداد option
    const category = await Category.findById(id);
    if (!category) throw new Error('Category not found');
    const descendants = await this.getCategoryDescendants(id);
    const attributes = await this.getAttributes(id);
    let totalOptions = 0;
    for (const attr of attributes) {
      const opts = await this.getAttributeOptions((attr as any)._id.toString());
      totalOptions += opts.length;
    }
    return {
      category: { id: category._id, name: category.name, slug: category.slug },
      stats: {
        subcategories: descendants.length,
        attributes: attributes.length,
        options: totalOptions,
      },
    };
  }

  async getCategoryPerformance(id: string, _options?: any): Promise<any> {
    // آمار پایه: تعداد زیرمجموعه، سطح، تعداد attribute
    const category = await Category.findById(id);
    if (!category) throw new Error('Category not found');
    const descendants = await this.getCategoryDescendants(id);
    const attributes = await this.getAttributes(id);
    return {
      category: { id: category._id, name: category.name, slug: category.slug },
      performance: {
        totalDescendants: descendants.length,
        level: category.level,
        attributes: attributes.length,
      },
    };
  }

  async getCategoryInsights(id: string, _options?: any): Promise<any> {
    // بینش ساده: بیشترین attribute، بیشترین option، سطح دسته
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
    return {
      insights: {
        mostOptionsAttribute: maxAttr,
        maxOptions,
        totalAttributes: attributes.length,
      },
    };
  }

  async getCategoryGrowth(id: string, _options?: any): Promise<any> {
    // رشد ساده: تعداد زیرمجموعه در بازه‌های زمانی (اینجا فقط snapshot فعلی)
    const descendants = await this.getCategoryDescendants(id);
    return {
      growth: {
        totalDescendants: descendants.length,
        // future: add time-based growth if you have timestamps
      },
    };
  }

  async getHierarchyAnalytics(rootId?: string): Promise<any> {
    // آمار سلسله‌مراتبی: تعداد کل دسته‌ها و زیرمجموعه‌ها از یک ریشه
    const root = rootId ? await Category.findById(rootId).lean() : null;
    let all: any[] = [];
    if (root) {
      // Ensure root._id is a string
      const rootIdStr = typeof root._id === 'string' ? root._id : root._id?.toString?.() ?? '';
      all = await this.getCategoryDescendants(rootIdStr);
    } else {
      all = await Category.find().lean();
    }
    return {
      root: root ? { id: root._id, name: root.name } : 'all',
      totalCategories: all.length,
    };
  }

  async getComparisonReport(categoryIds: string[], _options?: any): Promise<any> {
    // مقایسه ساده: تعداد attribute و descendant برای هر دسته
    const result = [];
    for (const id of categoryIds) {
      const category = await Category.findById(id);
      if (!category) continue;
      const descendants = await this.getCategoryDescendants(id);
      const attributes = await this.getAttributes(id);
      result.push({
        id: category._id,
        name: category.name,
        descendants: descendants.length,
        attributes: attributes.length,
      });
    }
    return result;
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
}

export const categoriesService = new CategoriesService(); 