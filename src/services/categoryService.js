import { Category, CategoryAttribute, CategoryAttributeOption, Product, ProductAttributeValue } from '../models/index.js';
import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import { generateCategorySlug, generateCustomSlug } from '../utils/slugGenerator.js';
import { i18nService } from './i18nService.js';

export const categoryService = {
      // Create a new category
      async create(categoryData) {
            let { image_ids, attributes, ...rest } = categoryData;
            // Backward compatibility: if old data has image_url, convert to image_ids
            // if (!image_ids && categoryData.image_url) {
            //       image_ids = [categoryData.image_url];
            // }
            const { name, parent_id, description, meta_title, meta_description, meta_keywords, settings, icon_ids, order, status, is_featured, slug: customSlug } = rest;

            // Get parent category if exists
            let parentSlug = null;
            if (parent_id) {
                  const parentCategory = await Category.findByPk(parent_id);
                  if (parentCategory) {
                        parentSlug = parentCategory.slug;
                  }
            }

            // Generate or validate slug
            let slug;
            if (customSlug) {
                  // Use custom slug if provided
                  const existingCategories = await Category.findAll({
                        attributes: ['slug'],
                        where: { deleted_at: null },
                        raw: true,
                  });
                  const existingSlugs = existingCategories.map(cat => cat.slug).filter(Boolean);

                  slug = generateCustomSlug(customSlug, existingSlugs);

                  // If there's a parent, prepend its slug
                  if (parentSlug) {
                        const parentSlugClean = parentSlug.replace(/\/$/, '');
                        slug = `${parentSlugClean}/${slug}`;
                  }
            } else {
                  // Generate automatic slug
                  slug = await generateCategorySlug(name, parentSlug, Category);
            }

            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  const category = await Category.create(
                        {
                              name,
                              slug,
                              parent_id,
                              description,
                              meta_title: meta_title || name,
                              meta_description,
                              meta_keywords,
                              settings,
                              image_ids,
                              icon_ids,
                              order,
                              status,
                              is_featured,
                        },
                        { transaction }
                  );

                  // Handle attributes if provided
                  if (attributes && Array.isArray(attributes)) {
                        for (const attr of attributes) {
                              const { name: attrName, type, required = false, order: attrOrder = 0, options = [] } = attr;

                              // Create the attribute
                              const categoryAttribute = await CategoryAttribute.create(
                                    {
                                          category_id: category.id,
                                          name: attrName,
                                          type,
                                          required,
                                          order: attrOrder,
                                    },
                                    { transaction }
                              );

                              // Create options if provided and type is enum
                              if (type === 'enum' && options && Array.isArray(options)) {
                                    for (let i = 0; i < options.length; i++) {
                                          await CategoryAttributeOption.create(
                                                {
                                                      category_attribute_id: categoryAttribute.id,
                                                      value: options[i],
                                                      order: i,
                                                },
                                                { transaction }
                                          );
                                    }
                              }
                        }
                  }

                  await transaction.commit();

                  // Fetch the category with its attributes
                  const categoryWithAttributes = await Category.findByPk(category.id, {
                        include: [
                              {
                                    model: CategoryAttribute,
                                    as: 'attributes',
                                    include: [
                                          {
                                                model: CategoryAttributeOption,
                                                as: 'options',
                                          },
                                    ],
                              },
                        ],
                  });

                  const plain = categoryWithAttributes.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Get category by ID with optimized tree loading
      async getById(id, { includeChildren = true, depth = 2, includeStats = false, includeAttributes = true, languageCode = 'en' } = {}) {
            const include = [];

            if (includeChildren) {
                  let currentInclude = {
                        model: Category,
                        as: 'children',
                        where: { status: 'active' },
                        required: false,
                        attributes: ['id', 'name', 'slug', 'parent_id', 'order', 'status', 'is_featured', 'image_ids', 'icon_ids'],
                  };

                  for (let i = 1; i < depth; i++) {
                        currentInclude.include = [
                              {
                                    model: Category,
                                    as: 'children',
                                    where: { status: 'active' },
                                    required: false,
                                    attributes: ['id', 'name', 'slug', 'parent_id', 'order', 'status', 'is_featured', 'image_ids', 'icon_ids'],
                              },
                        ];
                        currentInclude = currentInclude.include[0];
                  }

                  include.push(currentInclude);
            }

            if (includeStats) {
                  include.push({
                        model: Product,
                        as: 'products',
                        attributes: [[fn('COUNT', col('products.id')), 'product_count']],
                        required: false,
                  });
            }

            if (includeAttributes) {
                  include.push({
                        model: CategoryAttribute,
                        as: 'attributes',
                        include: [
                              {
                                    model: CategoryAttributeOption,
                                    as: 'options',
                              },
                        ],
                        order: [
                              ['order', 'ASC'],
                              [{ model: CategoryAttributeOption, as: 'options' }, 'order', 'ASC'],
                        ],
                  });
            }

            const result = await Category.findOne({
                  where: { id, status: 'active' },
                  include,
                  attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'meta_title', 'meta_description', 'meta_keywords', 'image_ids', 'icon_ids', 'order', 'status', 'is_featured', 'level', 'path', 'created_at', 'updated_at'],
            });

            if (!result) return null;

            // If language code is provided and not default, get with translations
            if (languageCode && languageCode !== 'en') {
                  const categoryWithTranslation = await i18nService.getCategoryWithTranslation(id, languageCode);
                  if (categoryWithTranslation) {
                        normalizeImageIds(categoryWithTranslation);
                        return categoryWithTranslation;
                  }
            }

            const plain = result.get({ plain: true });
            normalizeImageIds(plain);
            return plain;
      },

      // Get category by slug with redirect support
      async getBySlug(slug, { includeChildren = true, depth = 2, includeStats = false, includeAttributes = true } = {}) {
            const include = [];

            if (includeChildren) {
                  let currentInclude = {
                        model: Category,
                        as: 'children',
                        where: { status: 'active' },
                        required: false,
                        attributes: ['id', 'name', 'slug', 'parent_id', 'order', 'status', 'is_featured', 'image_ids', 'icon_ids'],
                  };

                  for (let i = 1; i < depth; i++) {
                        currentInclude.include = [
                              {
                                    model: Category,
                                    as: 'children',
                                    where: { status: 'active' },
                                    required: false,
                                    attributes: ['id', 'name', 'slug', 'parent_id', 'order', 'status', 'is_featured', 'image_ids', 'icon_ids'],
                              },
                        ];
                        currentInclude = currentInclude.include[0];
                  }

                  include.push(currentInclude);
            }

            if (includeStats) {
                  include.push({
                        model: Product,
                        as: 'products',
                        attributes: [[fn('COUNT', col('products.id')), 'product_count']],
                        required: false,
                  });
            }

            if (includeAttributes) {
                  include.push({
                        model: CategoryAttribute,
                        as: 'attributes',
                        include: [
                              {
                                    model: CategoryAttributeOption,
                                    as: 'options',
                              },
                        ],
                        order: [
                              ['order', 'ASC'],
                              [{ model: CategoryAttributeOption, as: 'options' }, 'order', 'ASC'],
                        ],
                  });
            }

            // First try to find by current slug
            let category = await Category.findOne({
                  where: { slug, status: 'active' },
                  include,
                  attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'meta_title', 'meta_description', 'meta_keywords', 'image_ids', 'icon_ids', 'order', 'status', 'is_featured', 'level', 'path', 'created_at', 'updated_at'],
            });

            // If not found, check redirects
            if (!category) {
                  category = await Category.findOne({
                        where: {
                              slug_redirects: { [Op.contains]: [slug] },
                              status: 'active',
                        },
                        include,
                        attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'meta_title', 'meta_description', 'meta_keywords', 'image_ids', 'icon_ids', 'order', 'status', 'is_featured', 'level', 'path', 'created_at', 'updated_at'],
                  });
            }

            if (!category) return null;
            const plain = category.get({ plain: true });
            normalizeImageIds(plain);
            return plain;
      },

      // Get optimized category tree with materialized path
      async getTree({ status = 'active', includeInactive = false, includeStats = false, maxDepth = 3, includeAttributes = true, page = 1, limit = 10 } = {}) {
            const where = includeInactive ? {} : { status };

            const include = [];
            if (includeStats) {
                  include.push({
                        model: Product,
                        as: 'products',
                        attributes: [[fn('COUNT', col('products.id')), 'product_count']],
                        required: false,
                  });
            }

            if (includeAttributes) {
                  include.push({
                        model: CategoryAttribute,
                        as: 'attributes',
                        include: [
                              {
                                    model: CategoryAttributeOption,
                                    as: 'options',
                              },
                        ],
                        order: [
                              ['order', 'ASC'],
                              [{ model: CategoryAttributeOption, as: 'options' }, 'order', 'ASC'],
                        ],
                  });
            }

            // Count total root categories for pagination
            const total = await Category.count({
                  where: {
                        ...where,
                        parent_id: null,
                  },
            });
            const offset = (page - 1) * limit;

            const result = await Category.findAll({
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
                              attributes: ['id', 'name', 'slug', 'parent_id', 'order', 'status', 'is_featured', 'image_ids', 'icon_ids'],
                              include: [
                                    {
                                          model: Category,
                                          as: 'children',
                                          where,
                                          required: false,
                                          attributes: ['id', 'name', 'slug', 'parent_id', 'order', 'status', 'is_featured', 'image_ids', 'icon_ids'],
                                    },
                              ],
                        },
                        ...include,
                  ],
                  attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'meta_title', 'meta_description', 'meta_keywords', 'image_ids', 'icon_ids', 'order', 'status', 'is_featured', 'level', 'path', 'created_at', 'updated_at'],
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                        [{ model: Category, as: 'children' }, 'order', 'ASC'],
                        [{ model: Category, as: 'children' }, 'name', 'ASC'],
                        [{ model: Category, as: 'children' }, { model: Category, as: 'children' }, 'order', 'ASC'],
                        [{ model: Category, as: 'children' }, { model: Category, as: 'children' }, 'name', 'ASC'],
                  ],
                  limit,
                  offset,
            });

            const plainResults = result.map(category => {
                  const plain = category.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            });
            return {
                  data: plainResults,
                  pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                  },
            };
      },

      // Update category with optimized slug regeneration
      async update(id, categoryData) {
            let { image_ids, attributes, ...rest } = categoryData;
            // Backward compatibility: if old data has image_url, convert to image_ids
            // if (!image_ids && categoryData.image_url) {
            //       image_ids = [categoryData.image_url];
            // }
            const category = await Category.findByPk(id);
            if (!category) return null;

            const { name, parent_id, description, meta_title, meta_description, meta_keywords, settings, icon_ids, order, status, is_featured, slug: customSlug } = categoryData;

            // Store old slug for redirect
            const oldSlug = category.slug;
            let newSlug = oldSlug;

            // Handle slug generation/update
            if (customSlug) {
                  // Use custom slug if provided
                  const existingCategories = await Category.findAll({
                        attributes: ['slug'],
                        where: {
                              deleted_at: null,
                              id: { [Op.ne]: id }, // Exclude current category
                        },
                        raw: true,
                  });
                  const existingSlugs = existingCategories.map(cat => cat.slug).filter(Boolean);

                  newSlug = generateCustomSlug(customSlug, existingSlugs);

                  // If there's a parent, prepend its slug
                  if (parent_id) {
                        const parentCategory = await Category.findByPk(parent_id);
                        if (parentCategory) {
                              const parentSlugClean = parentCategory.slug.replace(/\/$/, '');
                              newSlug = `${parentSlugClean}/${newSlug}`;
                        }
                  }

                  categoryData.slug = newSlug;
            } else if (name || parent_id) {
                  // Regenerate slug if name or parent_id changed
                  let parentSlug = null;
                  if (parent_id) {
                        const parentCategory = await Category.findByPk(parent_id);
                        if (parentCategory) {
                              parentSlug = parentCategory.slug;
                        }
                  }

                  newSlug = await generateCategorySlug(name || category.name, parentSlug, Category);
                  categoryData.slug = newSlug;
            }

            // Add redirect if slug changed
            if (oldSlug && newSlug && oldSlug !== newSlug) {
                  const redirects = category.slug_redirects || [];
                  if (!redirects.includes(oldSlug)) {
                        redirects.push(oldSlug);
                        categoryData.slug_redirects = redirects;
                  }
            }

            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  await category.update({ ...rest, image_ids, icon_ids, slug: categoryData.slug, slug_redirects: categoryData.slug_redirects }, { transaction });

                  // Handle attributes if provided
                  if (attributes && Array.isArray(attributes)) {
                        // Delete existing attributes
                        await CategoryAttribute.destroy({
                              where: { category_id: id },
                              transaction,
                        });

                        // Create new attributes
                        for (const attr of attributes) {
                              const { name: attrName, type, required = false, order: attrOrder = 0, options = [] } = attr;

                              // Create the attribute
                              const categoryAttribute = await CategoryAttribute.create(
                                    {
                                          category_id: id,
                                          name: attrName,
                                          type,
                                          required,
                                          order: attrOrder,
                                    },
                                    { transaction }
                              );

                              // Create options if provided and type is enum
                              if (type === 'enum' && options && Array.isArray(options)) {
                                    for (let i = 0; i < options.length; i++) {
                                          await CategoryAttributeOption.create(
                                                {
                                                      category_attribute_id: categoryAttribute.id,
                                                      value: options[i],
                                                      order: i,
                                                },
                                                { transaction }
                                          );
                                    }
                              }
                        }
                  }

                  await transaction.commit();

                  // Fetch the updated category with its attributes
                  const updatedCategory = await Category.findByPk(id, {
                        include: [
                              {
                                    model: CategoryAttribute,
                                    as: 'attributes',
                                    include: [
                                          {
                                                model: CategoryAttributeOption,
                                                as: 'options',
                                          },
                                    ],
                              },
                        ],
                  });

                  const plain = updatedCategory.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Delete category with optimized checks
      async delete(id) {
            const category = await Category.findByPk(id);
            if (!category) return false;

            // Use optimized query to check for children
            const hasChildren = await Category.count({
                  where: { parent_id: id },
                  limit: 1,
            });

            if (hasChildren > 0) {
                  throw new Error('Cannot delete category with children');
            }

            // Check for products
            const hasProducts = await Product.count({
                  where: { category_id: id },
                  limit: 1,
            });

            if (hasProducts > 0) {
                  throw new Error('Cannot delete category with products');
            }

            await category.destroy();
            return true;
      },

      // Optimized search with full-text search support
      async search(searchParams, { page = 1, limit = 10, includeStats = false, includeAttributes = true } = {}) {
            const offset = (page - 1) * limit;
            const where = {};

            // Build search conditions
            if (searchParams.name) {
                  where.name = { [Op.iLike]: `%${searchParams.name}%` };
            }

            if (searchParams.slug) {
                  where.slug = { [Op.iLike]: `%${searchParams.slug}%` };
            }

            if (searchParams.status) {
                  where.status = searchParams.status;
            }

            if (searchParams.parent_id) {
                  where.parent_id = searchParams.parent_id;
            }

            if (searchParams.is_featured !== undefined) {
                  where.is_featured = searchParams.is_featured;
            }

            if (!searchParams.include_deleted) {
                  where.deleted_at = null;
            }

            const include = [];
            if (includeStats) {
                  include.push({
                        model: Product,
                        as: 'products',
                        attributes: [[fn('COUNT', col('products.id')), 'product_count']],
                        required: false,
                  });
            }

            if (includeAttributes) {
                  include.push({
                        model: CategoryAttribute,
                        as: 'attributes',
                        include: [
                              {
                                    model: CategoryAttributeOption,
                                    as: 'options',
                              },
                        ],
                        order: [
                              ['order', 'ASC'],
                              [{ model: CategoryAttributeOption, as: 'options' }, 'order', 'ASC'],
                        ],
                  });
            }

            const { count, rows } = await Category.findAndCountAll({
                  where,
                  include,
                  attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'meta_title', 'meta_description', 'meta_keywords', 'image_ids', 'icon_ids', 'order', 'status', 'is_featured', 'level', 'path', 'created_at', 'updated_at'],
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                  ],
                  limit,
                  offset,
            });

            const plainRows = rows.map(category => {
                  const plain = category.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            });

            return {
                  data: plainRows,
                  pagination: {
                        page,
                        limit,
                        total: count,
                        pages: Math.ceil(count / limit),
                  },
            };
      },

      // Advanced search with multiple criteria
      async advancedSearch(searchParams, { page = 1, limit = 10 } = {}) {
            const offset = (page - 1) * limit;
            const where = {};

            // Full-text search
            if (searchParams.q) {
                  where[Op.or] = [{ name: { [Op.iLike]: `%${searchParams.q}%` } }, { description: { [Op.iLike]: `%${searchParams.q}%` } }, { slug: { [Op.iLike]: `%${searchParams.q}%` } }];
            }

            // Status filter
            if (searchParams.status) {
                  where.status = searchParams.status;
            }

            // Featured filter
            if (searchParams.is_featured !== undefined) {
                  where.is_featured = searchParams.is_featured;
            }

            // Date range filter
            if (searchParams.created_after) {
                  where.created_at = { [Op.gte]: new Date(searchParams.created_after) };
            }

            if (searchParams.created_before) {
                  where.created_at = { ...where.created_at, [Op.lte]: new Date(searchParams.created_before) };
            }

            // Level filter
            if (searchParams.level) {
                  where.level = searchParams.level;
            }

            // Parent filter
            if (searchParams.parent_id) {
                  where.parent_id = searchParams.parent_id;
            }

            const { count, rows } = await Category.findAndCountAll({
                  where,
                  attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'meta_title', 'meta_description', 'meta_keywords', 'image_ids', 'icon_ids', 'order', 'status', 'is_featured', 'level', 'path', 'created_at', 'updated_at'],
                  order: [searchParams.sort_by ? [searchParams.sort_by, searchParams.sort_order || 'ASC'] : ['order', 'ASC'], ['name', 'ASC']],
                  limit,
                  offset,
            });

            const plainRows = rows.map(category => {
                  const plain = category.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            });

            return {
                  items: plainRows,
                  pagination: {
                        page,
                        limit,
                        total: count,
                        pages: Math.ceil(count / limit),
                  },
            };
      },

      // Bulk operations with transaction support
      async bulkUpdate(categories) {
            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  const results = [];

                  for (const category of categories) {
                        const { id, name, parent_id, description, status, is_featured, order, image_ids, icon_ids } = category;

                        const result = await Category.update(
                              {
                                    name,
                                    parent_id,
                                    description,
                                    status,
                                    is_featured,
                                    order,
                                    image_ids,
                                    icon_ids,
                                    updated_at: new Date(),
                              },
                              {
                                    where: { id },
                                    transaction,
                              }
                        );

                        if (result[0] > 0) {
                              const updatedCategory = await Category.findByPk(id, { transaction });
                              const plain = updatedCategory.get({ plain: true });
                              normalizeImageIds(plain);
                              results.push(plain);
                        }
                  }

                  await transaction.commit();
                  return results;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Bulk delete with validation
      async bulkDelete(categoryIds) {
            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  const results = [];

                  for (const id of categoryIds) {
                        // Check for children
                        const hasChildren = await Category.count({
                              where: { parent_id: id },
                              transaction,
                        });

                        if (hasChildren > 0) {
                              results.push({ id, success: false, error: 'Has children' });
                              continue;
                        }

                        // Check for products
                        const hasProducts = await Product.count({
                              where: { category_id: id },
                              transaction,
                        });

                        if (hasProducts > 0) {
                              results.push({ id, success: false, error: 'Has products' });
                              continue;
                        }

                        const deleted = await Category.destroy({
                              where: { id },
                              transaction,
                        });

                        results.push({ id, success: deleted > 0 });
                  }

                  await transaction.commit();
                  return results;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Reorder categories with optimized updates
      async reorderCategories(orderedIds) {
            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  const updates = orderedIds.map((id, index) => ({
                        id,
                        order: index + 1,
                  }));

                  for (const update of updates) {
                        await Category.update({ order: update.order }, { where: { id: update.id }, transaction });
                  }

                  await transaction.commit();
                  return { success: true, updated: updates.length };
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Get category statistics with optimized queries
      async getCategoryStats(id) {
            const category = await Category.findByPk(id);
            if (!category) return null;

            // Get direct product count
            const productCount = await Product.count({
                  where: { category_id: id },
            });

            // Get subcategory count
            const subcategoryCount = await Category.count({
                  where: { parent_id: id },
            });

            // Get total products in subcategories
            const totalProductCount = await this._getTotalProductCount(id);

            // Get attribute count
            const attributeCount = await CategoryAttribute.count({
                  where: { category_id: id },
            });

            return {
                  category: {
                        id: category.id,
                        name: category.name,
                        slug: category.slug,
                  },
                  stats: {
                        directProducts: productCount,
                        totalProducts: totalProductCount,
                        subcategories: subcategoryCount,
                        attributes: attributeCount,
                        level: category.level,
                  },
            };
      },

      // Get breadcrumb with optimized path resolution
      async getBreadcrumb(id) {
            const category = await Category.findByPk(id);
            if (!category) return null;

            if (!category.path || category.path.length === 0) {
                  return [category];
            }

            const breadcrumb = await Category.findAll({
                  where: { id: category.path },
                  attributes: ['id', 'name', 'slug', 'parent_id'],
                  order: [['level', 'ASC']],
            });

            return [...breadcrumb, category];
      },

      // Get featured categories with optimized query
      async getFeaturedCategories(limit = 10) {
            const categories = await Category.findAll({
                  where: {
                        is_featured: true,
                        status: 'active',
                  },
                  attributes: ['id', 'name', 'slug', 'parent_id', 'description', 'image_ids', 'icon_ids', 'order'],
                  limit,
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                  ],
            });
            return categories.map(category => {
                  const plain = category.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            });
      },

      // Category attribute management
      async addAttribute(categoryId, attributeData) {
            const { name, type, required = false, order = 0, options = [] } = attributeData;

            const attribute = await CategoryAttribute.create({
                  category_id: categoryId,
                  name,
                  type,
                  required,
                  order,
            });

            // Add options if provided
            if (options && options.length > 0) {
                  for (const option of options) {
                        await CategoryAttributeOption.create({
                              category_attribute_id: attribute.id,
                              value: option.value,
                              order: option.order || 0,
                        });
                  }
            }

            return attribute;
      },

      async updateAttribute(attributeId, attributeData) {
            const attribute = await CategoryAttribute.findByPk(attributeId);
            if (!attribute) return null;

            return await attribute.update(attributeData);
      },

      async deleteAttribute(attributeId) {
            const attribute = await CategoryAttribute.findByPk(attributeId);
            if (!attribute) return false;

            await attribute.destroy();
            return true;
      },

      async getAttributes(categoryId) {
            return await CategoryAttribute.findAll({
                  where: { category_id: categoryId },
                  include: [
                        {
                              model: CategoryAttributeOption,
                              as: 'options',
                              attributes: ['id', 'value', 'order'],
                              order: [['order', 'ASC']],
                        },
                  ],
                  order: [['order', 'ASC']],
            });
      },

      // Attribute option management
      async addAttributeOption(attributeId, value, order = 0) {
            return await CategoryAttributeOption.create({
                  category_attribute_id: attributeId,
                  value,
                  order,
            });
      },

      async updateAttributeOption(optionId, value, order) {
            const option = await CategoryAttributeOption.findByPk(optionId);
            if (!option) return null;

            return await option.update({ value, order });
      },

      async deleteAttributeOption(optionId) {
            const option = await CategoryAttributeOption.findByPk(optionId);
            if (!option) return false;

            await option.destroy();
            return true;
      },

      async getAttributeOptions(attributeId) {
            return await CategoryAttributeOption.findAll({
                  where: { category_attribute_id: attributeId },
                  order: [['order', 'ASC']],
            });
      },

      // Get required attributes for category hierarchy
      async getRequiredAttributesForCategory(categoryId) {
            const attributes = [];
            let currentCategoryId = categoryId;

            while (currentCategoryId) {
                  const attrs = await CategoryAttribute.findAll({
                        where: { category_id: currentCategoryId, required: true },
                        include: [{ model: CategoryAttributeOption, as: 'options' }],
                  });
                  attributes.unshift(...attrs);

                  const cat = await Category.findByPk(currentCategoryId);
                  currentCategoryId = cat && cat.parent_id ? cat.parent_id : null;
            }

            return attributes;
      },

      // Create product with attributes validation
      async createProductWithAttributes(productData, attributeValues) {
            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  // Get required attributes
                  const requiredAttributes = await this.getRequiredAttributesForCategory(productData.category_id);

                  // Validate required attributes
                  for (const attr of requiredAttributes) {
                        const val = attributeValues.find(v => v.category_attribute_id == attr.id);
                        if (!val || val.value === undefined || val.value === null || val.value === '') {
                              throw new Error(`Attribute '${attr.name}' is required`);
                        }

                        // Type validation
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

                  // Create product
                  const product = await Product.create(productData, { transaction });

                  // Create attribute values
                  for (const attrVal of attributeValues) {
                        await ProductAttributeValue.create(
                              {
                                    product_id: product.id,
                                    category_attribute_id: attrVal.category_attribute_id,
                                    value: attrVal.value,
                              },
                              { transaction }
                        );
                  }

                  await transaction.commit();
                  return product;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Helper method to get total product count including subcategories
      async _getTotalProductCount(categoryId) {
            const descendants = await this._getCategoryAndDescendants(categoryId);
            return await Product.count({
                  where: { category_id: { [Op.in]: descendants } },
            });
      },

      // Helper method to get category and all descendants
      async _getCategoryAndDescendants(categoryId) {
            const descendants = [categoryId];
            const queue = [categoryId];

            while (queue.length > 0) {
                  const currentId = queue.shift();
                  const children = await Category.findAll({
                        where: { parent_id: currentId },
                        attributes: ['id'],
                  });

                  for (const child of children) {
                        descendants.push(child.id);
                        queue.push(child.id);
                  }
            }

            return descendants;
      },

      // NEW: Clone category with all attributes and subcategories
      async cloneCategory(categoryId, newName, newParentId = null) {
            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  const originalCategory = await Category.findByPk(categoryId, {
                        include: [
                              {
                                    model: CategoryAttribute,
                                    as: 'attributes',
                                    include: [
                                          {
                                                model: CategoryAttributeOption,
                                                as: 'options',
                                          },
                                    ],
                              },
                        ],
                  });

                  if (!originalCategory) {
                        throw new Error('Original category not found');
                  }

                  // Generate new slug
                  let parentSlug = null;
                  if (newParentId) {
                        const parentCategory = await Category.findByPk(newParentId);
                        if (parentCategory) {
                              parentSlug = parentCategory.slug;
                        }
                  }

                  const newSlug = await generateCategorySlug(newName, parentSlug, Category);

                  // Create new category
                  const newCategory = await Category.create(
                        {
                              name: newName,
                              slug: newSlug,
                              parent_id: newParentId,
                              description: originalCategory.description,
                              meta_title: originalCategory.meta_title,
                              meta_description: originalCategory.meta_description,
                              meta_keywords: originalCategory.meta_keywords,
                              image_ids: originalCategory.image_ids,
                              icon_ids: originalCategory.icon_ids,
                              order: originalCategory.order,
                              status: 'draft', // Start as draft
                              is_featured: false,
                              level: newParentId ? (await Category.findByPk(newParentId)).level + 1 : 1,
                        },
                        { transaction }
                  );

                  // Clone attributes
                  for (const attr of originalCategory.attributes) {
                        const newAttr = await CategoryAttribute.create(
                              {
                                    category_id: newCategory.id,
                                    name: attr.name,
                                    type: attr.type,
                                    required: attr.required,
                                    order: attr.order,
                              },
                              { transaction }
                        );

                        // Clone attribute options
                        for (const option of attr.options) {
                              await CategoryAttributeOption.create(
                                    {
                                          category_attribute_id: newAttr.id,
                                          value: option.value,
                                          order: option.order,
                                    },
                                    { transaction }
                              );
                        }
                  }

                  await transaction.commit();

                  // Fetch the cloned category with its attributes
                  const clonedCategoryWithAttributes = await Category.findByPk(newCategory.id, {
                        include: [
                              {
                                    model: CategoryAttribute,
                                    as: 'attributes',
                                    include: [
                                          {
                                                model: CategoryAttributeOption,
                                                as: 'options',
                                          },
                                    ],
                              },
                        ],
                  });

                  return clonedCategoryWithAttributes;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // NEW: Get category template
      async getCategoryTemplate(templateId) {
            return await Category.findByPk(templateId, {
                  include: [
                        {
                              model: CategoryAttribute,
                              as: 'attributes',
                              include: [
                                    {
                                          model: CategoryAttributeOption,
                                          as: 'options',
                                    },
                              ],
                        },
                  ],
            });
      },

      // NEW: Create category from template
      async createFromTemplate(templateId, categoryData) {
            const template = await this.getCategoryTemplate(templateId);
            if (!template) {
                  throw new Error('Template not found');
            }

            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  let { image_ids, ...rest } = categoryData;
                  // if (!image_ids && categoryData.image_url) {
                  //       image_ids = [categoryData.image_url];
                  // }

                  // Generate slug
                  let parentSlug = null;
                  if (categoryData.parent_id) {
                        const parentCategory = await Category.findByPk(categoryData.parent_id);
                        if (parentCategory) {
                              parentSlug = parentCategory.slug;
                        }
                  }

                  const slug = await generateCategorySlug(categoryData.name, parentSlug, Category);

                  // Create category
                  const category = await Category.create(
                        {
                              name: categoryData.name,
                              slug,
                              parent_id: categoryData.parent_id,
                              description: categoryData.description || template.description,
                              meta_title: categoryData.meta_title || template.meta_title,
                              meta_description: categoryData.meta_description || template.meta_description,
                              meta_keywords: categoryData.meta_keywords || template.meta_keywords,
                              image_ids,
                              icon_ids: categoryData.icon_ids || template.icon_ids,
                              order: categoryData.order || template.order,
                              status: categoryData.status || 'draft',
                              is_featured: categoryData.is_featured || false,
                              level: categoryData.parent_id ? (await Category.findByPk(categoryData.parent_id)).level + 1 : 1,
                        },
                        { transaction }
                  );

                  // Copy attributes from template
                  for (const attr of template.attributes) {
                        const newAttr = await CategoryAttribute.create(
                              {
                                    category_id: category.id,
                                    name: attr.name,
                                    type: attr.type,
                                    required: attr.required,
                                    order: attr.order,
                              },
                              { transaction }
                        );

                        // Copy attribute options
                        for (const option of attr.options) {
                              await CategoryAttributeOption.create(
                                    {
                                          category_attribute_id: newAttr.id,
                                          value: option.value,
                                          order: option.order,
                                    },
                                    { transaction }
                              );
                        }
                  }

                  await transaction.commit();

                  // Fetch the category with its attributes
                  const categoryWithAttributes = await Category.findByPk(category.id, {
                        include: [
                              {
                                    model: CategoryAttribute,
                                    as: 'attributes',
                                    include: [
                                          {
                                                model: CategoryAttributeOption,
                                                as: 'options',
                                          },
                                    ],
                              },
                        ],
                  });

                  const plain = categoryWithAttributes.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // NEW: Submit category for approval
      async submitForApproval(categoryId, submittedBy) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            if (category.status !== 'draft') {
                  throw new Error('Only draft categories can be submitted for approval');
            }

            return await category.update({
                  status: 'pending_approval',
                  submitted_by: submittedBy,
                  submitted_at: new Date(),
            });
      },

      // NEW: Approve category
      async approveCategory(categoryId, approvedBy) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            if (category.status !== 'pending_approval') {
                  throw new Error('Category is not pending approval');
            }

            return await category.update({
                  status: 'active',
                  approved_by: approvedBy,
                  approved_at: new Date(),
            });
      },

      // NEW: Reject category
      async rejectCategory(categoryId, rejectedBy, reason) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            if (category.status !== 'pending_approval') {
                  throw new Error('Category is not pending approval');
            }

            return await category.update({
                  status: 'rejected',
                  rejected_by: rejectedBy,
                  rejected_at: new Date(),
                  rejection_reason: reason,
            });
      },

      // NEW: Export categories
      async exportCategories(format, options = {}) {
            const { includeSubcategories = true, includeAttributes = true } = options;

            let categories;
            if (includeSubcategories) {
                  categories = await Category.findAll({
                        include: includeAttributes
                              ? [
                                      {
                                            model: CategoryAttribute,
                                            as: 'attributes',
                                            include: [
                                                  {
                                                        model: CategoryAttributeOption,
                                                        as: 'options',
                                                  },
                                            ],
                                      },
                                ]
                              : [],
                        order: [
                              ['level', 'ASC'],
                              ['order', 'ASC'],
                              ['name', 'ASC'],
                        ],
                  });
            } else {
                  categories = await Category.findAll({
                        where: { parent_id: null },
                        include: includeAttributes
                              ? [
                                      {
                                            model: CategoryAttribute,
                                            as: 'attributes',
                                            include: [
                                                  {
                                                        model: CategoryAttributeOption,
                                                        as: 'options',
                                                  },
                                            ],
                                      },
                                ]
                              : [],
                        order: [
                              ['order', 'ASC'],
                              ['name', 'ASC'],
                        ],
                  });
            }

            const plainCategories = categories.map(cat => {
                  const plain = cat.get({ plain: true });
                  normalizeImageIds(plain);
                  return plain;
            });
            switch (format.toLowerCase()) {
                  case 'json':
                        return JSON.stringify(plainCategories, null, 2);
                  case 'csv':
                        return this._convertToCSV(plainCategories, includeAttributes);
                  case 'xml':
                        return this._convertToXML(plainCategories, includeAttributes);
                  default:
                        throw new Error('Unsupported export format');
            }
      },

      // NEW: Import categories
      async importCategories(format, data, options = {}) {
            const { updateExisting = false, skipErrors = false } = options;

            let categories;
            try {
                  switch (format.toLowerCase()) {
                        case 'json':
                              categories = typeof data === 'string' ? JSON.parse(data) : data;
                              break;
                        case 'csv':
                              categories = this._parseFromCSV(data);
                              break;
                        case 'xml':
                              categories = this._parseFromXML(data);
                              break;
                        default:
                              throw new Error('Unsupported import format');
                  }
            } catch (error) {
                  throw new Error(`Failed to parse ${format} data: ${error.message}`);
            }

            const results = {
                  total: categories.length,
                  success: 0,
                  failed: 0,
                  errors: [],
            };

            const { sequelize } = await import('../models/index.js');
            const transaction = await sequelize.transaction();

            try {
                  for (const categoryData of categories) {
                        try {
                              if (updateExisting && categoryData.id) {
                                    // Update existing category
                                    const existingCategory = await Category.findByPk(categoryData.id);
                                    if (existingCategory) {
                                          await this.update(categoryData.id, categoryData);
                                          results.success++;
                                          continue;
                                    }
                              }

                              // Create new category
                              await this.create(categoryData);
                              results.success++;
                        } catch (error) {
                              results.failed++;
                              results.errors.push({
                                    category: categoryData.name || 'Unknown',
                                    error: error.message,
                              });

                              if (!skipErrors) {
                                    throw error;
                              }
                        }
                  }

                  await transaction.commit();
                  return results;
            } catch (error) {
                  await transaction.rollback();
                  throw error;
            }
      },

      // Helper method to convert categories to CSV
      _convertToCSV(categories, includeAttributes) {
            const headers = ['id', 'name', 'slug', 'parent_id', 'description', 'status', 'is_featured', 'order', 'level'];
            if (includeAttributes) {
                  headers.push('attributes');
            }

            const csvRows = [headers.join(',')];

            for (const category of categories) {
                  const row = [category.id, `"${category.name}"`, category.slug, category.parent_id || '', `"${category.description || ''}"`, category.status, category.is_featured ? 'true' : 'false', category.order, category.level];

                  if (includeAttributes && category.attributes) {
                        const attributes = category.attributes.map(attr => `${attr.name}:${attr.type}:${attr.required ? 'required' : 'optional'}`).join(';');
                        row.push(`"${attributes}"`);
                  }

                  csvRows.push(row.join(','));
            }

            return csvRows.join('\n');
      },

      // Helper method to convert categories to XML
      _convertToXML(categories, includeAttributes) {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<categories>\n';

            for (const category of categories) {
                  xml += `  <category>\n`;
                  xml += `    <id>${category.id}</id>\n`;
                  xml += `    <name>${this._escapeXML(category.name)}</name>\n`;
                  xml += `    <slug>${category.slug}</slug>\n`;
                  xml += `    <parent_id>${category.parent_id || ''}</parent_id>\n`;
                  xml += `    <description>${this._escapeXML(category.description || '')}</description>\n`;
                  xml += `    <status>${category.status}</status>\n`;
                  xml += `    <is_featured>${category.is_featured ? 'true' : 'false'}</is_featured>\n`;
                  xml += `    <order>${category.order}</order>\n`;
                  xml += `    <level>${category.level}</level>\n`;

                  if (includeAttributes && category.attributes) {
                        xml += `    <attributes>\n`;
                        for (const attr of category.attributes) {
                              xml += `      <attribute>\n`;
                              xml += `        <name>${this._escapeXML(attr.name)}</name>\n`;
                              xml += `        <type>${attr.type}</type>\n`;
                              xml += `        <required>${attr.required ? 'true' : 'false'}</required>\n`;
                              xml += `        <order>${attr.order}</order>\n`;
                              if (attr.options && attr.options.length > 0) {
                                    xml += `        <options>\n`;
                                    for (const option of attr.options) {
                                          xml += `          <option>\n`;
                                          xml += `            <value>${this._escapeXML(option.value)}</value>\n`;
                                          xml += `            <order>${option.order}</order>\n`;
                                          xml += `          </option>\n`;
                                    }
                                    xml += `        </options>\n`;
                              }
                              xml += `      </attribute>\n`;
                        }
                        xml += `    </attributes>\n`;
                  }

                  xml += `  </category>\n`;
            }

            xml += '</categories>';
            return xml;
      },

      // Helper method to parse categories from CSV
      _parseFromCSV(csvData) {
            const lines = csvData.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const categories = [];

            for (let i = 1; i < lines.length; i++) {
                  if (!lines[i].trim()) continue;

                  const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                  const category = {};

                  headers.forEach((header, index) => {
                        if (header === 'attributes') {
                              if (values[index]) {
                                    category.attributes = values[index].split(';').map(attr => {
                                          const [name, type, required] = attr.split(':');
                                          return { name, type, required: required === 'required' };
                                    });
                              }
                        } else {
                              category[header] = values[index];
                        }
                  });

                  categories.push(category);
            }

            return categories;
      },

      // Helper method to parse categories from XML
      _parseFromXML(xmlData) {
            // This is a simplified XML parser - in production, you'd use a proper XML library
            const categories = [];
            const categoryMatches = xmlData.match(/<category>([\s\S]*?)<\/category>/g);

            if (categoryMatches) {
                  for (const match of categoryMatches) {
                        const category = {};

                        // Extract basic fields
                        const idMatch = match.match(/<id>(.*?)<\/id>/);
                        if (idMatch) category.id = parseInt(idMatch[1]);

                        const nameMatch = match.match(/<name>(.*?)<\/name>/);
                        if (nameMatch) category.name = nameMatch[1];

                        const slugMatch = match.match(/<slug>(.*?)<\/slug>/);
                        if (slugMatch) category.slug = slugMatch[1];

                        const parentIdMatch = match.match(/<parent_id>(.*?)<\/parent_id>/);
                        if (parentIdMatch && parentIdMatch[1]) category.parent_id = parseInt(parentIdMatch[1]);

                        const descriptionMatch = match.match(/<description>(.*?)<\/description>/);
                        if (descriptionMatch) category.description = descriptionMatch[1];

                        const statusMatch = match.match(/<status>(.*?)<\/status>/);
                        if (statusMatch) category.status = statusMatch[1];

                        const isFeaturedMatch = match.match(/<is_featured>(.*?)<\/is_featured>/);
                        if (isFeaturedMatch) category.is_featured = isFeaturedMatch[1] === 'true';

                        const orderMatch = match.match(/<order>(.*?)<\/order>/);
                        if (orderMatch) category.order = parseInt(orderMatch[1]);

                        const levelMatch = match.match(/<level>(.*?)<\/level>/);
                        if (levelMatch) category.level = parseInt(levelMatch[1]);

                        // Extract attributes if present
                        const attributesMatch = match.match(/<attributes>([\s\S]*?)<\/attributes>/);
                        if (attributesMatch) {
                              category.attributes = [];
                              const attributeMatches = attributesMatch[1].match(/<attribute>([\s\S]*?)<\/attribute>/g);

                              if (attributeMatches) {
                                    for (const attrMatch of attributeMatches) {
                                          const attribute = {};

                                          const attrNameMatch = attrMatch.match(/<name>(.*?)<\/name>/);
                                          if (attrNameMatch) attribute.name = attrNameMatch[1];

                                          const attrTypeMatch = attrMatch.match(/<type>(.*?)<\/type>/);
                                          if (attrTypeMatch) attribute.type = attrTypeMatch[1];

                                          const attrRequiredMatch = attrMatch.match(/<required>(.*?)<\/required>/);
                                          if (attrRequiredMatch) attribute.required = attrRequiredMatch[1] === 'true';

                                          const attrOrderMatch = attrMatch.match(/<order>(.*?)<\/order>/);
                                          if (attrOrderMatch) attribute.order = parseInt(attrOrderMatch[1]);

                                          category.attributes.push(attribute);
                                    }
                              }
                        }

                        categories.push(category);
                  }
            }

            return categories;
      },

      // Helper method to escape XML special characters
      _escapeXML(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      },

      // Add slug redirect
      async addSlugRedirect(categoryId, oldSlug) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            const redirects = category.slug_redirects || [];
            if (!redirects.includes(oldSlug)) {
                  redirects.push(oldSlug);
                  await category.update({ slug_redirects: redirects });
            }

            return category;
      },

      // Remove slug redirect
      async removeSlugRedirect(categoryId, oldSlug) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            const redirects = category.slug_redirects || [];
            const updatedRedirects = redirects.filter(redirect => redirect !== oldSlug);

            await category.update({ slug_redirects: updatedRedirects });
            return category;
      },

      // Get all redirects for a category
      async getSlugRedirects(categoryId) {
            const category = await Category.findByPk(categoryId, {
                  attributes: ['id', 'name', 'slug', 'slug_redirects'],
            });

            if (!category) {
                  throw new Error('Category not found');
            }

            return category.slug_redirects || [];
      },

      // Get legacy category tree (flat + inline children)
      async getLegacyTree() {
            // Get all categories
            const categories = await Category.findAll({
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                  ],
                  raw: true,
            });

            // Build a map of id -> category
            const categoryMap = {};
            categories.forEach(cat => {
                  categoryMap[cat.id] = { ...cat, children: [] };
            });

            // Build the tree structure
            const roots = [];
            categories.forEach(cat => {
                  if (cat.parent_id) {
                        if (categoryMap[cat.parent_id]) {
                              categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
                        }
                  } else {
                        roots.push(categoryMap[cat.id]);
                  }
            });

            return { items: roots };
      },
};

// Utility to ensure image_ids and icon_ids are always arrays and remove image_url/icon_url from output
function normalizeImageIds(category) {
      if (category) {
            if (!Array.isArray(category.image_ids) || category.image_ids == null) {
                  category.image_ids = [];
            }
            if (!Array.isArray(category.icon_ids) || category.icon_ids == null) {
                  category.icon_ids = [];
            }
            // Remove deprecated fields if present
            //   if ('image_url' in category) delete category.image_url;
            //   if ('icon_url' in category) delete category.icon_url;
      }
      return category;
}
