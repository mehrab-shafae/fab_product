import { Router } from 'express';
import * as categoriesController from '../controllers/categories.controller.js';
import {
  preventCircularReference,
  checkParentCategoryExists,
  checkCategoryExists,
  validateCreateCategory,
  validateUpdateCategory,
  validateApproval
} from '../middlewares/categoryMiddleware.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const router = Router();
const swaggerDocument = YAML.load(cwd('product/modules/categories/swagger.yaml'));

router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// CRUD
router.post('/', validateCreateCategory, checkParentCategoryExists, preventCircularReference, categoriesController.createCategory);
router.get('/', categoriesController.getCategories);
router.get('/tree', categoriesController.getCategoryTree);
router.get('/featured', categoriesController.getFeaturedCategories);
router.get('/search', categoriesController.searchCategories);
router.get('/search/advanced', categoriesController.advancedSearchCategories);
router.get('/slug/:slug', asyncHandler(categoriesController.getCategoryBySlug));
router.get('/:id', checkCategoryExists, asyncHandler(categoriesController.getCategoryById));
router.put('/:id', validateUpdateCategory, checkCategoryExists, checkParentCategoryExists, preventCircularReference, asyncHandler(categoriesController.updateCategory));
router.delete('/:id', checkCategoryExists, asyncHandler(categoriesController.deleteCategory));

// Bulk
router.put('/bulk', categoriesController.bulkUpdateCategories);
router.delete('/bulk', categoriesController.bulkDeleteCategories);

// Breadcrumb, stats, full, descendants, ancestors, siblings
router.get('/:id/breadcrumb', checkCategoryExists, categoriesController.getCategoryBreadcrumb);
router.get('/:id/stats', checkCategoryExists, categoriesController.getCategoryStats);
router.get('/:id/statistics', checkCategoryExists, categoriesController.getCategoryStatistics);
router.get('/:id/full', checkCategoryExists, asyncHandler(categoriesController.getCategoryFullDetails));
router.get('/:id/descendants', checkCategoryExists, categoriesController.getCategoryDescendants);
router.get('/:id/ancestors', checkCategoryExists, categoriesController.getCategoryAncestors);
router.get('/:id/siblings', checkCategoryExists, categoriesController.getCategorySiblings);

// Attribute APIs
router.post('/:categoryId/attributes', categoriesController.addAttribute);
router.get('/:categoryId/attributes', categoriesController.getAttributes);
router.get('/:categoryId/attributes/inherited', categoriesController.getAllAttributesWithInheritanceController);
router.get('/attributes', categoriesController.getAttributesAdvanced);
router.put('/attributes/bulk', categoriesController.bulkUpdateAttributes);
router.delete('/attributes/bulk', categoriesController.bulkDeleteAttributes);
router.put('/attributes/:attributeId', categoriesController.updateAttribute);
router.delete('/attributes/:attributeId', categoriesController.deleteAttribute);
router.post('/attributes/:attributeId/options', categoriesController.addAttributeOption);
router.get('/attributes/:attributeId/options', categoriesController.getAttributeOptions);
router.put('/attributes/options/:optionId', categoriesController.updateAttributeOption);
router.delete('/attributes/options/:optionId', categoriesController.deleteAttributeOption);

// Slug redirects
router.post('/:id/redirects', checkCategoryExists, asyncHandler(categoriesController.addSlugRedirect));
router.delete('/:id/redirects/:oldSlug', checkCategoryExists, categoriesController.removeSlugRedirect);
router.get('/:id/redirects', checkCategoryExists, categoriesController.getSlugRedirects);

// Export/Import
router.get('/export/:format', categoriesController.exportCategories);
router.post('/import', categoriesController.importCategories);

// Clone, template, create from template
router.post('/:id/clone', checkCategoryExists, asyncHandler(categoriesController.cloneCategory));
router.get('/templates/:templateId', asyncHandler(categoriesController.getCategoryTemplate));
router.post('/templates/:templateId/create', asyncHandler(categoriesController.createFromTemplate));

// Approval workflow
router.post('/:id/submit-approval', checkCategoryExists, validateApproval, categoriesController.submitForApproval);
router.post('/:id/approve', checkCategoryExists, validateApproval, categoriesController.approveCategory);
router.post('/:id/reject', checkCategoryExists, validateApproval, categoriesController.rejectCategory);

// Reorder
router.post('/reorder', categoriesController.reorderCategories);

// By status, level, parent
router.get('/status/:status', categoriesController.getCategoriesByStatus);
router.get('/level/:level', categoriesController.getCategoriesByLevel);
router.get('/parent/:parentId', categoriesController.getCategoriesByParent);

// Analytics/Performance/Insights/Growth/Comparison/Hierarchy Analytics
router.get('/:id/analytics', checkCategoryExists, categoriesController.getCategoryAnalytics);
router.get('/:id/performance', checkCategoryExists, categoriesController.getCategoryPerformance);
router.get('/:id/insights', checkCategoryExists, categoriesController.getCategoryInsights);
router.get('/:id/growth', checkCategoryExists, categoriesController.getCategoryGrowth);
router.get('/hierarchy/analytics', categoriesController.getHierarchyAnalytics);
router.post('/comparison', categoriesController.getComparisonReport);

// Legacy tree
router.get('/legacy-tree', categoriesController.getLegacyTree);

export default router; 