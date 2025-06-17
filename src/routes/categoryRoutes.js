import express from 'express';
import { categoryController } from '../controllers/categoryController.js';
import { categoryMiddleware } from '../middlewares/categoryMiddleware.js';

const router = express.Router();

// Create a new category
router.post('/',
    categoryMiddleware.validateCategoryData,
    categoryMiddleware.validateParentCategory,
    categoryMiddleware.checkDuplicateName,
    categoryController.create
);

// Get category by ID
router.get('/:id',
    categoryMiddleware.validateCategoryId,
    categoryController.getById
);

// Get category by slug
router.get('/slug/:slug',
    categoryController.getBySlug
);

// Get category tree
router.get('/tree',
    categoryController.getCategoryTree
);

// Update category
router.put('/:id',
    categoryMiddleware.validateCategoryId,
    categoryMiddleware.validateCategoryData,
    categoryMiddleware.validateParentCategory,
    categoryMiddleware.checkDuplicateName,
    categoryController.update
);

// Delete category
router.delete('/:id',
    categoryMiddleware.validateCategoryId,
    categoryController.delete
);

// Search categories
router.get('/',
    categoryController.search
);

// Bulk update categories
router.put('/bulk',
    categoryMiddleware.validateCategoryData,
    categoryController.bulkUpdate
);

// Get category path (breadcrumb)
router.get('/:id/path',
    categoryMiddleware.validateCategoryId,
    categoryController.getCategoryPath
);

// Get category statistics
router.get('/:id/stats',
    categoryMiddleware.validateCategoryId,
    categoryController.getCategoryStats
);

export default router; 