import express from 'express';
import { categoryController } from '../controllers/categoryController.js';
import { categoryMiddleware } from '../middlewares/categoryMiddleware.js';

const router = express.Router();

// Static routes first
router.get('/tree', categoryController.getCategoryTree);
router.get('/search', categoryController.search);
router.get('/slug/:slug', categoryController.getBySlug);
router.put('/bulk', categoryMiddleware.validateCategoryData, categoryController.bulkUpdate);

// Dynamic routes last
router.post('/',
    categoryMiddleware.validateCategoryData,
    categoryMiddleware.validateParentCategory,
    categoryMiddleware.checkDuplicateName,
    categoryController.create
);

router.get('/:id',
    categoryMiddleware.validateCategoryId,
    categoryController.getById
);

router.put('/:id',
    categoryMiddleware.validateCategoryId,
    categoryMiddleware.validateCategoryData,
    categoryMiddleware.validateParentCategory,
    categoryMiddleware.checkDuplicateName,
    categoryController.update
);

router.delete('/:id',
    categoryMiddleware.validateCategoryId,
    categoryController.delete
);

router.get('/:id/path',
    categoryMiddleware.validateCategoryId,
    categoryController.getCategoryPath
);

router.get('/:id/stats',
    categoryMiddleware.validateCategoryId,
    categoryController.getCategoryStats
);

export default router; 