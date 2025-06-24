import { categoryService } from '../services/categoryService.js';

export const categoryController = {
      // Create a new category
      async create(req, res) {
            try {
                  const category = await categoryService.create(req.body);
                  res.success(category, 'Category created successfully');
            } catch (error) {
                  if (error.name === 'SequelizeUniqueConstraintError') {
                        return res.error('A category with this name or slug already exists', 409);
                  }
                  res.error(error);
            }
      },

      // Get category by ID
      async getById(req, res) {
            try {
                  const { id } = req.params;
                  const languageCode = req.languageCode || 'en';
                  
                  const category = await categoryService.getById(parseInt(id), {
                        includeChildren: true,
                        depth: 2,
                        includeStats: false,
                        includeAttributes: true,
                        languageCode,
                  });

                  if (!category) {
                        return res.status(404).json({
                              error: 'Category not found',
                              message: 'Category with the specified ID does not exist',
                        });
                  }

                  res.success(category, 'Category retrieved successfully');
            } catch (error) {
                  res.error(error);
            }
      },

      // Get category by slug
      async getBySlug(req, res) {
            try {
                  const category = await categoryService.getBySlug(req.params.slug);
                  if (!category) {
                        return res.error('Category not found', 404);
                  }
                  res.success(category);
            } catch (error) {
                  res.error(error);
            }
      },

      // Get category tree
      async getCategoryTree(req, res) {
            try {
                  const categories = await categoryService.getCategoryTree();
                  res.success(categories);
            } catch (error) {
                  res.error(error);
            }
      },

      // Update category
      async update(req, res) {
            try {
                  const category = await categoryService.update(req.params.id, req.body);
                  if (!category) {
                        return res.error('Category not found', 404);
                  }
                  res.success(category, 'Category updated successfully');
            } catch (error) {
                  if (error.name === 'SequelizeUniqueConstraintError') {
                        return res.error('A category with this name or slug already exists', 409);
                  }
                  res.error(error);
            }
      },

      // Delete category
      async delete(req, res) {
            try {
                  const success = await categoryService.delete(req.params.id);
                  if (!success) {
                        return res.error('Category not found', 404);
                  }
                  res.success(null, 'Category deleted successfully');
            } catch (error) {
                  if (error.message === 'Cannot delete category with children') {
                        return res.error(error.message, 400);
                  }
                  res.error(error);
            }
      },

      // Search categories
      async search(req, res) {
            try {
                  const { page, limit } = req.query;
                  const categories = await categoryService.search(req.query, {
                        page: parseInt(page) || 1,
                        limit: parseInt(limit) || 10,
                  });
                  res.success(categories);
            } catch (error) {
                  res.error(error);
            }
      },

      // Bulk update categories
      async bulkUpdate(req, res) {
            try {
                  const results = await categoryService.bulkUpdate(req.body);
                  res.success(results, 'Categories updated successfully');
            } catch (error) {
                  if (error.name === 'SequelizeUniqueConstraintError') {
                        return res.error('A category with this name or slug already exists', 409);
                  }
                  res.error(error);
            }
      },

      // Get category path (breadcrumb)
      async getCategoryPath(req, res) {
            try {
                  const path = await categoryService.getCategoryPath(req.params.id);
                  if (!path.length) {
                        return res.error('Category not found', 404);
                  }
                  res.success(path);
            } catch (error) {
                  res.error(error);
            }
      },

      // Get category statistics
      async getCategoryStats(req, res) {
            try {
                  const stats = await categoryService.getCategoryStats(req.params.id);
                  if (!stats) {
                        return res.error('Category not found', 404);
                  }
                  res.success(stats);
            } catch (error) {
                  res.error(error);
            }
      },

      // Get legacy category tree (flat + inline children)
      async getLegacyTree(req, res) {
            try {
                  const result = await categoryService.getLegacyTree();
                  res.success(result, 'Legacy tree retrieved successfully');
            } catch (error) {
                  res.error(error);
            }
      },
};
