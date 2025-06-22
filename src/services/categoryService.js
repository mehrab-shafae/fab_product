import { Category, CategoryAttribute, CategoryAttributeOption, Product, ProductAttributeValue } from '../models/index.js';
import { Op } from 'sequelize';
import { generateCategorySlug } from '../utils/slugGenerator.js';

export const categoryService = {
      // Create a new category
      async create(categoryData) {
            const { name, parent_id, description, meta_title, meta_description, meta_keywords, attributes, settings, image_url, icon_url, order, status, is_featured } = categoryData;

            // Get parent category if exists
            let parentSlug = null;
            if (parent_id) {
                  const parentCategory = await Category.findByPk(parent_id);
                  if (parentCategory) {
                        parentSlug = parentCategory.slug;
                  }
            }

            // Generate slug
            const slug = await generateCategorySlug(name, parentSlug, Category);

            return await Category.create({
                  name,
                  slug,
                  parent_id,
                  description,
                  meta_title: meta_title || name,
                  meta_description,
                  meta_keywords,
                  attributes,
                  settings,
                  image_url,
                  icon_url,
                  order,
                  status,
                  is_featured,
            });
      },

      // Get category by ID with full tree
      async getById(id, { includeChildren = true, depth = 2 } = {}) {
            const include = [];

            if (includeChildren) {
                  let currentInclude = {
                        model: Category,
                        as: 'children',
                        where: { status: 'active' },
                        required: false,
                  };

                  for (let i = 1; i < depth; i++) {
                        currentInclude.include = [
                              {
                                    model: Category,
                                    as: 'children',
                                    where: { status: 'active' },
                                    required: false,
                              },
                        ];
                        currentInclude = currentInclude.include[0];
                  }

                  include.push(currentInclude);
            }

            return await Category.findOne({
                  where: { id, status: 'active' },
                  include,
            });
      },

      // Get category by slug with full tree
      async getBySlug(slug, { includeChildren = true, depth = 2 } = {}) {
            const include = [];

            if (includeChildren) {
                  let currentInclude = {
                        model: Category,
                        as: 'children',
                        where: { status: 'active' },
                        required: false,
                  };

                  for (let i = 1; i < depth; i++) {
                        currentInclude.include = [
                              {
                                    model: Category,
                                    as: 'children',
                                    where: { status: 'active' },
                                    required: false,
                              },
                        ];
                        currentInclude = currentInclude.include[0];
                  }

                  include.push(currentInclude);
            }

            return await Category.findOne({
                  where: { slug, status: 'active' },
                  include,
            });
      },

      // Get full category tree
      async getTree({ status = 'active', includeInactive = false } = {}) {
            const where = includeInactive ? {} : { status };

            return await Category.findAll({
                  where: {
                        ...where,
                        parent_id: null,
                  },
                  include: [
                        {
                              model: Category,
                              as: 'children',
                              where,
                              required: false,
                              include: [
                                    {
                                          model: Category,
                                          as: 'children',
                                          where,
                                          required: false,
                                    },
                              ],
                        },
                  ],
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                        [{ model: Category, as: 'children' }, 'order', 'ASC'],
                        [{ model: Category, as: 'children' }, 'name', 'ASC'],
                        [{ model: Category, as: 'children' }, { model: Category, as: 'children' }, 'order', 'ASC'],
                        [{ model: Category, as: 'children' }, { model: Category, as: 'children' }, 'name', 'ASC'],
                  ],
            });
      },

      // Update category
      async update(id, categoryData) {
            const category = await Category.findByPk(id);
            if (!category) return null;

            const { name, parent_id, description, meta_title, meta_description, meta_keywords, attributes, settings, image_url, icon_url, order, status, is_featured } = categoryData;

            // If name or parent_id changed, regenerate slug
            if (name || parent_id) {
                  let parentSlug = null;
                  if (parent_id) {
                        const parentCategory = await Category.findByPk(parent_id);
                        if (parentCategory) {
                              parentSlug = parentCategory.slug;
                        }
                  }

                  categoryData.slug = await generateCategorySlug(name || category.name, parentSlug, Category);
            }

            return await category.update({
                  name,
                  parent_id,
                  description,
                  meta_title,
                  meta_description,
                  meta_keywords,
                  attributes,
                  settings,
                  image_url,
                  icon_url,
                  order,
                  status,
                  is_featured,
            });
      },

      // Delete category (soft delete)
      async delete(id) {
            const category = await Category.findByPk(id);
            if (!category) return false;

            // Check if category has children
            const hasChildren = await Category.count({
                  where: { parent_id: id },
            });

            if (hasChildren > 0) {
                  throw new Error('Cannot delete category with children');
            }

            await category.destroy();
            return true;
      },

      // Search categories
      async search(searchParams, { page = 1, limit = 10 } = {}) {
            const offset = (page - 1) * limit;
            const where = {};

            if (searchParams.name) {
                  where.name = {
                        [Op.iLike]: `%${searchParams.name}%`,
                  };
            }

            if (searchParams.parent_id) {
                  where.parent_id = searchParams.parent_id;
            }

            if (searchParams.slug) {
                  where.slug = {
                        [Op.iLike]: `%${searchParams.slug}%`,
                  };
            }

            if (searchParams.status) {
                  where.status = searchParams.status;
            }

            if (searchParams.is_featured !== undefined) {
                  where.is_featured = searchParams.is_featured;
            }

            const { count, rows } = await Category.findAndCountAll({
                  where,
                  limit,
                  offset,
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                  ],
                  include: [
                        {
                              model: Category,
                              as: 'children',
                              required: false,
                        },
                  ],
            });

            return {
                  total: count,
                  page,
                  limit,
                  categories: rows,
            };
      },

      // Bulk update categories
      async bulkUpdate(categories) {
            const results = await Promise.all(
                  categories.map(async category => {
                        const { id, name, parent_id, description, meta_title, meta_description, meta_keywords, attributes, settings, image_url, icon_url, order, status, is_featured } = category;
                        const existingCategory = await Category.findByPk(id);

                        if (!existingCategory) return null;

                        // If name or parent_id changed, regenerate slug
                        if (name || parent_id) {
                              let parentSlug = null;
                              if (parent_id) {
                                    const parentCategory = await Category.findByPk(parent_id);
                                    if (parentCategory) {
                                          parentSlug = parentCategory.slug;
                                    }
                              }

                              category.slug = await generateCategorySlug(name || existingCategory.name, parentSlug, Category);
                        }

                        const [updatedCategory] = await Category.update(category, {
                              where: { id },
                              returning: true,
                        });
                        return updatedCategory;
                  })
            );
            return results.filter(Boolean);
      },

      // Get category statistics
      async getCategoryStats(id) {
            const category = await Category.findByPk(id, {
                  include: [
                        {
                              model: Category,
                              as: 'children',
                        },
                  ],
            });

            if (!category) return null;

            const stats = {
                  total_products: 0,
                  total_subcategories: category.children.length,
                  average_price: 0,
                  total_sales: 0,
                  featured_products: 0,
                  active_products: 0,
                  total_views: 0,
                  total_reviews: 0,
                  average_rating: 0,
            };

            // Here you can add more statistics based on your needs
            // For example, you might want to join with products table
            // and calculate more metrics

            return stats;
      },

      // Get category breadcrumb
      async getBreadcrumb(id) {
            const category = await Category.findByPk(id);
            if (!category) return null;

            const breadcrumb = [];
            let currentCategory = category;

            while (currentCategory) {
                  breadcrumb.unshift({
                        id: currentCategory.id,
                        name: currentCategory.name,
                        slug: currentCategory.slug,
                  });

                  if (currentCategory.parent_id) {
                        currentCategory = await Category.findByPk(currentCategory.parent_id);
                  } else {
                        break;
                  }
            }

            return breadcrumb;
      },

      // Reorder categories
      async reorderCategories(orderedIds) {
            const updates = orderedIds.map((id, index) => ({
                  id,
                  order: index,
            }));

            return await this.bulkUpdate(updates);
      },

      // Get featured categories
      async getFeaturedCategories(limit = 10) {
            return await Category.findAll({
                  where: {
                        is_featured: true,
                        status: 'active',
                  },
                  limit,
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                  ],
                  include: [
                        {
                              model: Category,
                              as: 'children',
                              where: { status: 'active' },
                              required: false,
                        },
                  ],
            });
      },

      // Category Attribute Management
      async addAttribute(categoryId, attributeData) {
            return await CategoryAttribute.create({
                  ...attributeData,
                  category_id: categoryId,
            });
      },
      async updateAttribute(attributeId, attributeData) {
            const attr = await CategoryAttribute.findByPk(attributeId);
            if (!attr) return null;
            return await attr.update(attributeData);
      },
      async deleteAttribute(attributeId) {
            const attr = await CategoryAttribute.findByPk(attributeId);
            if (!attr) return false;
            await attr.destroy();
            return true;
      },
      async getAttributes(categoryId) {
            return await CategoryAttribute.findAll({
                  where: { category_id: categoryId },
                  include: [{ model: CategoryAttributeOption, as: 'options' }],
                  order: [
                        ['order', 'ASC'],
                        ['id', 'ASC'],
                  ],
            });
      },
      // Category Attribute Option Management
      async addAttributeOption(attributeId, value, order = 0) {
            return await CategoryAttributeOption.create({
                  category_attribute_id: attributeId,
                  value,
                  order,
            });
      },
      async updateAttributeOption(optionId, value, order) {
            const opt = await CategoryAttributeOption.findByPk(optionId);
            if (!opt) return null;
            return await opt.update({ value, order });
      },
      async deleteAttributeOption(optionId) {
            const opt = await CategoryAttributeOption.findByPk(optionId);
            if (!opt) return false;
            await opt.destroy();
            return true;
      },
      async getAttributeOptions(attributeId) {
            return await CategoryAttributeOption.findAll({
                  where: { category_attribute_id: attributeId },
                  order: [
                        ['order', 'ASC'],
                        ['id', 'ASC'],
                  ],
            });
      },
      // دریافت attributeهای اجباری یک دسته و والدهایش
      async getRequiredAttributesForCategory(categoryId) {
            // دریافت همه attributeهای اجباری این دسته و والدهایش (سلسله‌مراتبی)
            let attributes = [];
            let currentCategoryId = categoryId;
            while (currentCategoryId) {
                  const attrs = await CategoryAttribute.findAll({
                        where: { category_id: currentCategoryId, required: true },
                        include: [{ model: CategoryAttributeOption, as: 'options' }],
                  });
                  attributes = [...attrs, ...attributes];
                  const cat = await Category.findByPk(currentCategoryId);
                  currentCategoryId = cat && cat.parent_id ? cat.parent_id : null;
            }
            return attributes;
      },
      // ساخت محصول با اعتبارسنجی attributeهای اجباری و ذخیره مقادیر آن‌ها
      async createProductWithAttributes(productData, attributeValues) {
            // productData: {name, price, description, category_id, ...}
            // attributeValues: [{category_attribute_id, value}]
            const requiredAttrs = await this.getRequiredAttributesForCategory(productData.category_id);
            // اعتبارسنجی attributeهای اجباری
            for (const attr of requiredAttrs) {
                  const val = attributeValues.find(v => v.category_attribute_id == attr.id);
                  if (!val || val.value === undefined || val.value === null || val.value === '') {
                        throw new Error(`Attribute '${attr.name}' is required`);
                  }
                  if (attr.type === 'number' && isNaN(Number(val.value))) {
                        throw new Error(`Attribute '${attr.name}' must be a number`);
                  }
                  if (attr.type === 'enum') {
                        const allowed = attr.options.map(o => o.value);
                        if (!allowed.includes(val.value)) {
                              throw new Error(`Attribute '${attr.name}' must be one of: ${allowed.join(', ')}`);
                        }
                  }
            }
            // ساخت محصول
            const product = await Product.create(productData);
            // ذخیره attributeها
            for (const attrVal of attributeValues) {
                  await ProductAttributeValue.create({
                        product_id: product.id,
                        category_attribute_id: attrVal.category_attribute_id,
                        value: attrVal.value,
                  });
            }
            return product;
      },
};
