import { Category } from '../models/index.js';
import { Op } from 'sequelize';
import { generateCategorySlug } from '../utils/slugGenerator.js';

export const categoryService = {
    // Create a new category
    async create(categoryData) {
        const { name, parent_id } = categoryData;
        
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
            ...categoryData,
            slug
        });
    },

    // Get category by ID
    async getById(id) {
        return await Category.findByPk(id, {
            include: [{
                model: Category,
                as: 'children',
                include: [{
                    model: Category,
                    as: 'children'
                }]
            }]
        });
    },

    // Get category by slug
    async getBySlug(slug) {
        return await Category.findOne({
            where: { slug },
            include: [{
                model: Category,
                as: 'children',
                include: [{
                    model: Category,
                    as: 'children'
                }]
            }]
        });
    },

    // Get category tree
    async getCategoryTree() {
        return await Category.findAll({
            where: { parent_id: null },
            include: [{
                model: Category,
                as: 'children',
                include: [{
                    model: Category,
                    as: 'children'
                }]
            }]
        });
    },

    // Update category
    async update(id, categoryData) {
        const category = await Category.findByPk(id);
        if (!category) return null;

        const { name, parent_id } = categoryData;
        
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

        return await category.update(categoryData);
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

        const { count, rows } = await Category.findAndCountAll({
            where,
            limit,
            offset,
            order: [['created_at', 'DESC']],
            include: [{
                model: Category,
                as: 'children'
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
                const { id, name, parent_id } = category;
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

    // Get category path (breadcrumb)
    async getCategoryPath(id) {
        const path = [];
        let currentCategory = await Category.findByPk(id);

        while (currentCategory) {
            path.unshift(currentCategory);
            if (currentCategory.parent_id) {
                currentCategory = await Category.findByPk(currentCategory.parent_id);
            } else {
                break;
            }
        }

        return path;
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
            total_sales: 0
        };

        // Here you can add more statistics based on your needs
        // For example, you might want to join with products table
        // and calculate more metrics

        return stats;
    }
}; 