import { Category } from '../models/index.js';
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
            is_featured
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
                required: false
            };

            for (let i = 1; i < depth; i++) {
                currentInclude.include = [{
                    model: Category,
                    as: 'children',
                    where: { status: 'active' },
                    required: false
                }];
                currentInclude = currentInclude.include[0];
            }

            include.push(currentInclude);
        }

        return await Category.findOne({
            where: { id, status: 'active' },
            include
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
                required: false
            };

            for (let i = 1; i < depth; i++) {
                currentInclude.include = [{
                    model: Category,
                    as: 'children',
                    where: { status: 'active' },
                    required: false
                }];
                currentInclude = currentInclude.include[0];
            }

            include.push(currentInclude);
        }

        return await Category.findOne({
            where: { slug, status: 'active' },
            include
        });
    },

    // Get full category tree
    async getTree({ status = 'active', includeInactive = false } = {}) {
        const where = includeInactive ? {} : { status };
        
        return await Category.findAll({
            where: {
                ...where,
                parent_id: null
            },
            include: [{
                model: Category,
                as: 'children',
                where,
                required: false,
                include: [{
                    model: Category,
                    as: 'children',
                    where,
                    required: false
                }]
            }],
            order: [
                ['order', 'ASC'],
                ['name', 'ASC'],
                [{ model: Category, as: 'children' }, 'order', 'ASC'],
                [{ model: Category, as: 'children' }, 'name', 'ASC'],
                [{ model: Category, as: 'children' }, { model: Category, as: 'children' }, 'order', 'ASC'],
                [{ model: Category, as: 'children' }, { model: Category, as: 'children' }, 'name', 'ASC']
            ]
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

            categoryData.slug = await generateCategorySlug(
                name || category.name,
                parentSlug,
                Category
            );
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
            is_featured
        });
    },

    // Delete category (soft delete)
    async delete(id) {
        const category = await Category.findByPk(id);
        if (!category) return false;

        // Check if category has children
        const hasChildren = await Category.count({
            where: { parent_id: id }
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
                [Op.iLike]: `%${searchParams.name}%`
            };
        }

        if (searchParams.parent_id) {
            where.parent_id = searchParams.parent_id;
        }

        if (searchParams.slug) {
            where.slug = {
                [Op.iLike]: `%${searchParams.slug}%`
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
                ['name', 'ASC']
            ],
            include: [{
                model: Category,
                as: 'children',
                required: false
            }]
        });

        return {
            total: count,
            page,
            limit,
            categories: rows
        };
    },

    // Bulk update categories
    async bulkUpdate(categories) {
        const results = await Promise.all(
            categories.map(async (category) => {
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

                    category.slug = await generateCategorySlug(
                        name || existingCategory.name,
                        parentSlug,
                        Category
                    );
                }

                const [updatedCategory] = await Category.update(
                    category,
                    {
                        where: { id },
                        returning: true
                    }
                );
                return updatedCategory;
            })
        );
        return results.filter(Boolean);
    },

    // Get category statistics
    async getCategoryStats(id) {
        const category = await Category.findByPk(id, {
            include: [{
                model: Category,
                as: 'children'
            }]
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
            average_rating: 0
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
                slug: currentCategory.slug
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
            order: index
        }));

        return await this.bulkUpdate(updates);
    },

    // Get featured categories
    async getFeaturedCategories(limit = 10) {
        return await Category.findAll({
            where: {
                is_featured: true,
                status: 'active'
            },
            limit,
            order: [
                ['order', 'ASC'],
                ['name', 'ASC']
            ],
            include: [{
                model: Category,
                as: 'children',
                where: { status: 'active' },
                required: false
            }]
        });
    }
}; 