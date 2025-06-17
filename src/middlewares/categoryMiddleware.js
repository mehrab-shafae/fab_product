import { Category } from '../models/index.js';

export const categoryMiddleware = {
    // Validate category ID
    async validateCategoryId(req, res, next) {
        try {
            const category = await Category.findByPk(req.params.id);
            if (!category) {
                return res.error('Category not found', 404);
            }
            req.category = category;
            next();
        } catch (error) {
            res.error(error);
        }
    },

    // Validate category data
    validateCategoryData(req, res, next) {
        const { name, parent_id } = req.body;

        if (!name) {
            return res.error('Category name is required', 400);
        }

        if (name.length < 2) {
            return res.error('Category name must be at least 2 characters long', 400);
        }

        if (name.length > 255) {
            return res.error('Category name must not exceed 255 characters', 400);
        }

        if (parent_id) {
            if (isNaN(parent_id)) {
                return res.error('Parent ID must be a number', 400);
            }
        }

        next();
    },

    // Validate parent category
    async validateParentCategory(req, res, next) {
        try {
            const { parent_id } = req.body;
            if (parent_id) {
                const parentCategory = await Category.findByPk(parent_id);
                if (!parentCategory) {
                    return res.error('Parent category not found', 404);
                }
                req.parentCategory = parentCategory;
            }
            next();
        } catch (error) {
            res.error(error);
        }
    },

    // Check for duplicate category name
    async checkDuplicateName(req, res, next) {
        try {
            const { name } = req.body;
            const existingCategory = await Category.findOne({
                where: {
                    name,
                    deleted_at: null
                }
            });

            if (existingCategory && existingCategory.id !== parseInt(req.params.id)) {
                return res.error('A category with this name already exists', 409);
            }

            next();
        } catch (error) {
            res.error(error);
        }
    }
}; 