import express from 'express';
import { categoryService } from '../services/categoryService.js';
import { validateRequiredFieldsMiddleware } from '../middleware/validation.js';

const router = express.Router();

// Create a new category
router.post('/', async (req, res) => {
      try {
            if (!req.body.name) {
                  return res.status(400).json({ error: 'Name is required' });
            }
            const category = await categoryService.create(req.body);
            res.status(201).json(category);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Get featured categories - This must come before /:id to avoid conflicts
router.get('/featured', async (req, res) => {
      try {
            const categories = await categoryService.getFeaturedCategories(parseInt(req.query.limit) || 10);
            res.json(categories);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Get category tree - This must come before /:id to avoid conflicts
router.get('/tree', async (req, res) => {
      try {
            const tree = await categoryService.getTree({
                  status: req.query.status,
                  includeInactive: req.query.includeInactive === 'true',
            });
            res.json(tree);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Search categories - This must come before /:id to avoid conflicts
router.get('/search', async (req, res) => {
      try {
            const result = await categoryService.search(req.query, {
                  page: parseInt(req.query.page) || 1,
                  limit: parseInt(req.query.limit) || 10,
            });
            res.json(result);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Get all categories - This must come before /:id to avoid conflicts
router.get('/', async (req, res) => {
      try {
            const result = await categoryService.search(req.query, {
                  page: parseInt(req.query.page) || 1,
                  limit: parseInt(req.query.limit) || 10,
            });
            res.json(result);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Get category by slug - This must come before /:id to avoid conflicts
router.get('/slug/:slug', async (req, res) => {
      try {
            const category = await categoryService.getBySlug(req.params.slug, {
                  includeChildren: true,
                  depth: 2,
            });
            if (!category) {
                  return res.status(404).json({ error: 'Category not found' });
            }
            res.json(category);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Get category by ID
router.get('/:id', async (req, res) => {
      try {
            const category = await categoryService.getById(req.params.id, {
                  includeChildren: true,
                  depth: 2,
            });
            if (!category) {
                  return res.status(404).json({ error: 'Category not found' });
            }
            res.json(category);
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
router.post('/reorder', async (req, res) => {
      try {
            if (!req.body.orderedIds) {
                  return res.status(400).json({ error: 'orderedIds is required' });
            }
            const result = await categoryService.reorderCategories(req.body.orderedIds);
            res.json(result);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Bulk update categories
router.put('/bulk', async (req, res) => {
      try {
            if (!req.body.categories) {
                  return res.status(400).json({ error: 'categories is required' });
            }
            const result = await categoryService.bulkUpdate(req.body.categories);
            res.json(result);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// Category Attribute APIs
router.post('/:categoryId/attributes', async (req, res) => {
      try {
            const attr = await categoryService.addAttribute(req.params.categoryId, req.body);
            res.status(201).json(attr);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
router.get('/:categoryId/attributes', async (req, res) => {
      try {
            const attrs = await categoryService.getAttributes(req.params.categoryId);
            res.json(attrs);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
router.put('/attributes/:attributeId', async (req, res) => {
      try {
            const attr = await categoryService.updateAttribute(req.params.attributeId, req.body);
            if (!attr) return res.status(404).json({ error: 'Attribute not found' });
            res.json(attr);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
router.delete('/attributes/:attributeId', async (req, res) => {
      try {
            const ok = await categoryService.deleteAttribute(req.params.attributeId);
            if (!ok) return res.status(404).json({ error: 'Attribute not found' });
            res.status(204).send();
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
// Category Attribute Option APIs
router.post('/attributes/:attributeId/options', async (req, res) => {
      try {
            const opt = await categoryService.addAttributeOption(req.params.attributeId, req.body.value, req.body.order);
            res.status(201).json(opt);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
router.get('/attributes/:attributeId/options', async (req, res) => {
      try {
            const opts = await categoryService.getAttributeOptions(req.params.attributeId);
            res.json(opts);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
router.put('/options/:optionId', async (req, res) => {
      try {
            const opt = await categoryService.updateAttributeOption(req.params.optionId, req.body.value, req.body.order);
            if (!opt) return res.status(404).json({ error: 'Option not found' });
            res.json(opt);
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});
router.delete('/options/:optionId', async (req, res) => {
      try {
            const ok = await categoryService.deleteAttributeOption(req.params.optionId);
            if (!ok) return res.status(404).json({ error: 'Option not found' });
            res.status(204).send();
      } catch (error) {
            res.status(500).json({ error: error.message });
      }
});

// ساخت محصول با attributeها
router.post('/products-with-attributes', async (req, res) => {
      try {
            const { product, attributes } = req.body; // product: {name, price, ...}, attributes: [{category_attribute_id, value}]
            const created = await categoryService.createProductWithAttributes(product, attributes);
            res.status(201).json(created);
      } catch (error) {
            res.status(400).json({ error: error.message });
      }
});

export default router;
