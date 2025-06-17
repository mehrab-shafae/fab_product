import express from 'express';
import { categoryService } from '../services/categoryService.js';
import { validateRequiredFieldsMiddleware } from '../middleware/validation.js';

const router = express.Router();

// Create a new category
router.post('/', validateRequiredFieldsMiddleware(['name']), async (req, res) => {
    try {
        const category = await categoryService.create(req.body);
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get category by ID
router.get('/:id', async (req, res) => {
    try {
        const category = await categoryService.getById(req.params.id, {
            includeChildren: true,
            depth: 2
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get category by slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const category = await categoryService.getBySlug(req.params.slug, {
            includeChildren: true,
            depth: 2
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get category tree
router.get('/tree', async (req, res) => {
    try {
        const tree = await categoryService.getTree({
            status: req.query.status,
            includeInactive: req.query.includeInactive === 'true'
        });
        res.json(tree);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update category
router.put('/:id', async (req, res) => {
    try {
        const category = await categoryService.update(req.params.id, req.body);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete category
router.delete('/:id', async (req, res) => {
    try {
        const success = await categoryService.delete(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search categories
router.get('/search', async (req, res) => {
    try {
        const result = await categoryService.search(req.query, {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get category breadcrumb
router.get('/:id/breadcrumb', async (req, res) => {
    try {
        const breadcrumb = await categoryService.getBreadcrumb(req.params.id);
        if (!breadcrumb) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(breadcrumb);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get category statistics
router.get('/:id/stats', async (req, res) => {
    try {
        const stats = await categoryService.getCategoryStats(req.params.id);
        if (!stats) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder categories
router.post('/reorder', validateRequiredFieldsMiddleware(['orderedIds']), async (req, res) => {
    try {
        const result = await categoryService.reorderCategories(req.body.orderedIds);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get featured categories
router.get('/featured', async (req, res) => {
    try {
        const categories = await categoryService.getFeaturedCategories(
            parseInt(req.query.limit) || 10
        );
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk update categories
router.put('/bulk', validateRequiredFieldsMiddleware(['categories']), async (req, res) => {
    try {
        const result = await categoryService.bulkUpdate(req.body.categories);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router; 