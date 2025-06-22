import express from 'express';
import { categoryService } from '../services/categoryService.js';
import { categoryAnalyticsService } from '../services/categoryAnalyticsService.js';
import { Category } from '../models/index.js';
import { validateRequiredFieldsMiddleware } from '../middleware/validation.js';
import { 
      categoryValidation, 
      handleValidationErrors, 
      checkCategoryExists, 
      checkParentCategoryExists, 
      preventCircularReference,
      logCategoryOperation 
} from '../middlewares/categoryMiddleware.js';
import { Op } from 'sequelize';

const router = express.Router();

// Create a new category
router.post('/', 
      categoryValidation.create,
      handleValidationErrors,
      checkParentCategoryExists,
      preventCircularReference,
      logCategoryOperation('create'),
      async (req, res) => {
            try {
                  const category = await categoryService.create(req.body);
                  res.status(201).json({
                        status: 'success',
                        data: category,
                        message: 'دسته با موفقیت ایجاد شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Get featured categories - This must come before /:id to avoid conflicts
router.get('/featured', async (req, res) => {
      try {
            const categories = await categoryService.getFeaturedCategories(parseInt(req.query.limit) || 10);
            res.json({
                  status: 'success',
                  data: categories,
                  message: 'دسته‌های ویژه با موفقیت دریافت شدند'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// Get category tree - This must come before /:id to avoid conflicts
router.get('/tree', async (req, res) => {
      try {
            const tree = await categoryService.getTree({
                  status: req.query.status,
                  includeInactive: req.query.includeInactive === 'true',
            });
            res.json({
                  status: 'success',
                  data: tree,
                  message: 'درخت دسته‌ها با موفقیت دریافت شد'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// Search categories - This must come before /:id to avoid conflicts
router.get('/search', 
      categoryValidation.search,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const result = await categoryService.search(req.query, {
                        page: parseInt(req.query.page) || 1,
                        limit: parseInt(req.query.limit) || 10,
                  });
                  res.json({
                        status: 'success',
                        data: result,
                        message: 'جستجوی دسته‌ها با موفقیت انجام شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Get all categories - This must come before /:id to avoid conflicts
router.get('/', 
      categoryValidation.search,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const result = await categoryService.search(req.query, {
                        page: parseInt(req.query.page) || 1,
                        limit: parseInt(req.query.limit) || 10,
                  });
                  res.json({
                        status: 'success',
                        data: result,
                        message: 'دسته‌ها با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Get category by slug - This must come before /:id to avoid conflicts
router.get('/slug/:slug', async (req, res) => {
      try {
            const category = await categoryService.getBySlug(req.params.slug, {
                  includeChildren: true,
                  depth: 2,
            });
            if (!category) {
                  return res.status(404).json({ 
                        status: 'error',
                        message: 'دسته مورد نظر یافت نشد' 
                  });
            }
            res.json({
                  status: 'success',
                  data: category,
                  message: 'دسته با موفقیت دریافت شد'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// Get category by ID
router.get('/:id', 
      categoryValidation.getById,
      handleValidationErrors,
      checkCategoryExists,
      async (req, res) => {
            try {
                  const category = await categoryService.getById(req.params.id, {
                        includeChildren: true,
                        depth: 2,
                  });
                  if (!category) {
                        return res.status(404).json({ 
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد' 
                        });
                  }
                  res.json({
                        status: 'success',
                        data: category,
                        message: 'دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Update category
router.put('/:id', 
      categoryValidation.update,
      handleValidationErrors,
      checkCategoryExists,
      checkParentCategoryExists,
      preventCircularReference,
      logCategoryOperation('update'),
      async (req, res) => {
            try {
                  const category = await categoryService.update(req.params.id, req.body);
                  if (!category) {
                        return res.status(404).json({ 
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد' 
                        });
                  }
                  res.json({
                        status: 'success',
                        data: category,
                        message: 'دسته با موفقیت بروزرسانی شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Delete category
router.delete('/:id', 
      categoryValidation.getById,
      handleValidationErrors,
      checkCategoryExists,
      logCategoryOperation('delete'),
      async (req, res) => {
            try {
                  const success = await categoryService.delete(req.params.id);
                  if (!success) {
                        return res.status(404).json({ 
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد' 
                        });
                  }
                  res.status(204).send();
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Get category breadcrumb
router.get('/:id/breadcrumb', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const breadcrumb = await categoryService.getBreadcrumb(req.params.id);
                  if (!breadcrumb) {
                        return res.status(404).json({ 
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد' 
                        });
                  }
                  res.json({
                        status: 'success',
                        data: breadcrumb,
                        message: 'مسیر دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Get category statistics
router.get('/:id/stats', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const stats = await categoryService.getCategoryStats(req.params.id);
                  if (!stats) {
                        return res.status(404).json({ 
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد' 
                        });
                  }
                  res.json({
                        status: 'success',
                        data: stats,
                        message: 'آمار دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get comprehensive category analytics
router.get('/:id/analytics', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const options = {
                        includeSubcategories: req.query.includeSubcategories !== 'false',
                        includeProducts: req.query.includeProducts !== 'false',
                        includeAttributes: req.query.includeAttributes !== 'false',
                        dateRange: req.query.dateRange || '30d',
                        groupBy: req.query.groupBy || 'day'
                  };

                  const analytics = await categoryAnalyticsService.getCategoryAnalytics(req.params.id, options);
                  res.json({
                        status: 'success',
                        data: analytics,
                        message: 'تحلیل‌های دسته با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category performance metrics
router.get('/:id/performance', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const options = {
                        dateRange: req.query.dateRange || '30d',
                        metrics: req.query.metrics ? req.query.metrics.split(',') : ['views', 'sales', 'revenue']
                  };

                  const performance = await categoryAnalyticsService.getCategoryPerformance(req.params.id, options);
                  res.json({
                        status: 'success',
                        data: performance,
                        message: 'معیارهای عملکرد دسته با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category insights and recommendations
router.get('/:id/insights', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const insights = await categoryAnalyticsService.getCategoryInsights(req.params.id);
                  res.json({
                        status: 'success',
                        data: insights,
                        message: 'بینش‌ها و توصیه‌های دسته با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category growth analysis
router.get('/:id/growth', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const options = {
                        periods: req.query.periods ? req.query.periods.split(',') : ['7d', '30d', '90d', '1y'],
                        metrics: req.query.metrics ? req.query.metrics.split(',') : ['products', 'views', 'sales']
                  };

                  const growth = await categoryAnalyticsService.getGrowthAnalysis(req.params.id, options);
                  res.json({
                        status: 'success',
                        data: growth,
                        message: 'تحلیل رشد دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get hierarchy analytics
router.get('/hierarchy/analytics', async (req, res) => {
      try {
            const rootCategoryId = req.query.rootId ? parseInt(req.query.rootId) : null;
            const analytics = await categoryAnalyticsService.getHierarchyAnalytics(rootCategoryId);
            res.json({
                  status: 'success',
                  data: analytics,
                  message: 'تحلیل‌های سلسله مراتب دسته‌ها با موفقیت دریافت شدند'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// NEW: Get comparison report
router.post('/comparison', 
      categoryValidation.comparison,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const { categoryIds } = req.body;
                  const options = {
                        dateRange: req.query.dateRange || '30d',
                        metrics: req.query.metrics ? req.query.metrics.split(',') : ['products', 'views', 'sales', 'revenue']
                  };

                  const comparison = await categoryAnalyticsService.getComparisonReport(categoryIds, options);
                  res.json({
                        status: 'success',
                        data: comparison,
                        message: 'گزارش مقایسه دسته‌ها با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Reorder categories
router.post('/reorder', 
      categoryValidation.reorder,
      handleValidationErrors,
      logCategoryOperation('reorder'),
      async (req, res) => {
            try {
                  const result = await categoryService.reorderCategories(req.body.orderedIds);
                  res.json({
                        status: 'success',
                        data: result,
                        message: 'ترتیب دسته‌ها با موفقیت تغییر یافت'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Bulk update categories
router.put('/bulk', 
      categoryValidation.bulkUpdate,
      handleValidationErrors,
      logCategoryOperation('bulk_update'),
      async (req, res) => {
            try {
                  const result = await categoryService.bulkUpdate(req.body.categories);
                  res.json({
                        status: 'success',
                        data: result,
                        message: 'دسته‌ها با موفقیت بروزرسانی شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Bulk delete categories
router.delete('/bulk', 
      categoryValidation.reorder,
      handleValidationErrors,
      logCategoryOperation('bulk_delete'),
      async (req, res) => {
            try {
                  const { categoryIds } = req.body;
                  const results = await Promise.all(
                        categoryIds.map(id => categoryService.delete(id))
                  );
                  
                  const successCount = results.filter(result => result).length;
                  const failedCount = results.length - successCount;
                  
                  res.json({
                        status: 'success',
                        data: {
                              total: results.length,
                              success: successCount,
                              failed: failedCount
                        },
                        message: `${successCount} دسته با موفقیت حذف شدند`
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Helper method to get content type for export
function getContentType(format) {
      switch (format.toLowerCase()) {
            case 'json':
                  return 'application/json';
            case 'csv':
                  return 'text/csv';
            case 'xml':
                  return 'application/xml';
            default:
                  return 'text/plain';
      }
}

// NEW: Export categories
router.get('/export/:format', 
      categoryValidation.export,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const { format } = req.params; // csv, json, xml
                  const { includeSubcategories = true, includeAttributes = true } = req.query;
                  
                  const exportData = await categoryService.exportCategories(format, {
                        includeSubcategories: includeSubcategories === 'true',
                        includeAttributes: includeAttributes === 'true'
                  });

                  // Set appropriate headers for file download
                  const filename = `categories_export_${new Date().toISOString().split('T')[0]}.${format}`;
                  res.setHeader('Content-Type', getContentType(format));
                  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                  
                  res.send(exportData);
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Import categories
router.post('/import', 
      categoryValidation.import,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const { format, data, options } = req.body;
                  
                  const results = await categoryService.importCategories(format, data, options);
                  
                  res.json({
                        status: 'success',
                        data: results,
                        message: `${results.success} دسته با موفقیت وارد شدند`
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// Category Attribute APIs
router.post('/:categoryId/attributes', 
      categoryValidation.attribute,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const attr = await categoryService.addAttribute(req.params.categoryId, req.body);
                  res.status(201).json({
                        status: 'success',
                        data: attr,
                        message: 'ویژگی دسته با موفقیت اضافه شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

router.get('/:categoryId/attributes', async (req, res) => {
      try {
            const attrs = await categoryService.getAttributes(req.params.categoryId);
            res.json({
                  status: 'success',
                  data: attrs,
                  message: 'ویژگی‌های دسته با موفقیت دریافت شدند'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

router.put('/attributes/:attributeId', 
      categoryValidation.attribute,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const attr = await categoryService.updateAttribute(req.params.attributeId, req.body);
                  res.json({
                        status: 'success',
                        data: attr,
                        message: 'ویژگی دسته با موفقیت بروزرسانی شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

router.delete('/attributes/:attributeId', async (req, res) => {
      try {
            const success = await categoryService.deleteAttribute(req.params.attributeId);
            if (success) {
                  res.status(204).send();
            } else {
                  res.status(404).json({ 
                        status: 'error',
                        message: 'ویژگی مورد نظر یافت نشد' 
                  });
            }
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// Category Attribute Option APIs
router.post('/attributes/:attributeId/options', async (req, res) => {
      try {
            const opt = await categoryService.addAttributeOption(req.params.attributeId, req.body.value, req.body.order);
            res.status(201).json({
                  status: 'success',
                  data: opt,
                  message: 'گزینه ویژگی با موفقیت اضافه شد'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

router.get('/attributes/:attributeId/options', async (req, res) => {
      try {
            const options = await categoryService.getAttributeOptions(req.params.attributeId);
            res.json({
                  status: 'success',
                  data: options,
                  message: 'گزینه‌های ویژگی با موفقیت دریافت شدند'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

router.put('/attributes/options/:optionId', async (req, res) => {
      try {
            const opt = await categoryService.updateAttributeOption(req.params.optionId, req.body.value, req.body.order);
            res.json({
                  status: 'success',
                  data: opt,
                  message: 'گزینه ویژگی با موفقیت بروزرسانی شد'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

router.delete('/attributes/options/:optionId', async (req, res) => {
      try {
            const success = await categoryService.deleteAttributeOption(req.params.optionId);
            if (success) {
                  res.status(204).send();
            } else {
                  res.status(404).json({ 
                        status: 'error',
                        message: 'گزینه مورد نظر یافت نشد' 
                  });
            }
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// NEW: Clone category
router.post('/:id/clone', 
      categoryValidation.clone,
      handleValidationErrors,
      checkCategoryExists,
      logCategoryOperation('clone'),
      async (req, res) => {
            try {
                  const { newName, newParentId } = req.body;
                  
                  if (!newName) {
                        return res.status(400).json({
                              status: 'error',
                              message: 'نام جدید برای دسته کپی شده الزامی است'
                        });
                  }

                  const clonedCategory = await categoryService.cloneCategory(req.params.id, newName, newParentId);
                  res.status(201).json({
                        status: 'success',
                        data: clonedCategory,
                        message: 'دسته با موفقیت کپی شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category template
router.get('/templates/:templateId', async (req, res) => {
      try {
            const template = await categoryService.getCategoryTemplate(req.params.templateId);
            if (!template) {
                  return res.status(404).json({
                        status: 'error',
                        message: 'قالب دسته مورد نظر یافت نشد'
                  });
            }
            res.json({
                  status: 'success',
                  data: template,
                  message: 'قالب دسته با موفقیت دریافت شد'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// NEW: Create category from template
router.post('/templates/:templateId/create', 
      categoryValidation.create,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const category = await categoryService.createFromTemplate(req.params.templateId, req.body);
                  res.status(201).json({
                        status: 'success',
                        data: category,
                        message: 'دسته از قالب با موفقیت ایجاد شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Submit category for approval
router.post('/:id/submit-approval', 
      categoryValidation.approval,
      handleValidationErrors,
      checkCategoryExists,
      logCategoryOperation('submit_approval'),
      async (req, res) => {
            try {
                  const { submittedBy } = req.body;
                  
                  if (!submittedBy) {
                        return res.status(400).json({
                              status: 'error',
                              message: 'شناسه کاربر ارسال‌کننده الزامی است'
                        });
                  }

                  const category = await categoryService.submitForApproval(req.params.id, submittedBy);
                  res.json({
                        status: 'success',
                        data: category,
                        message: 'دسته برای تایید ارسال شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Approve category
router.post('/:id/approve', 
      categoryValidation.approve,
      handleValidationErrors,
      checkCategoryExists,
      logCategoryOperation('approve'),
      async (req, res) => {
            try {
                  const { approvedBy } = req.body;
                  
                  if (!approvedBy) {
                        return res.status(400).json({
                              status: 'error',
                              message: 'شناسه کاربر تاییدکننده الزامی است'
                        });
                  }

                  const category = await categoryService.approveCategory(req.params.id, approvedBy);
                  res.json({
                        status: 'success',
                        data: category,
                        message: 'دسته با موفقیت تایید شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Reject category
router.post('/:id/reject', 
      categoryValidation.reject,
      handleValidationErrors,
      checkCategoryExists,
      logCategoryOperation('reject'),
      async (req, res) => {
            try {
                  const { rejectedBy, reason } = req.body;
                  
                  if (!rejectedBy) {
                        return res.status(400).json({
                              status: 'error',
                              message: 'شناسه کاربر ردکننده الزامی است'
                        });
                  }

                  if (!reason) {
                        return res.status(400).json({
                              status: 'error',
                              message: 'دلیل رد کردن الزامی است'
                        });
                  }

                  const category = await categoryService.rejectCategory(req.params.id, rejectedBy, reason);
                  res.json({
                        status: 'success',
                        data: category,
                        message: 'دسته رد شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Advanced search
router.get('/search/advanced', 
      categoryValidation.search,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const result = await categoryService.advancedSearch(req.query, {
                        page: parseInt(req.query.page) || 1,
                        limit: parseInt(req.query.limit) || 10,
                  });
                  res.json({
                        status: 'success',
                        data: result,
                        message: 'جستجوی پیشرفته دسته‌ها با موفقیت انجام شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get categories by status
router.get('/status/:status', async (req, res) => {
      try {
            const { status } = req.params;
            const { page = 1, limit = 10 } = req.query;
            
            const result = await categoryService.search({ status }, {
                  page: parseInt(page),
                  limit: parseInt(limit),
            });
            
            res.json({
                  status: 'success',
                  data: result,
                  message: `دسته‌های با وضعیت ${status} با موفقیت دریافت شدند`
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// NEW: Get categories by level
router.get('/level/:level', async (req, res) => {
      try {
            const { level } = req.params;
            const { page = 1, limit = 10 } = req.query;
            
            const result = await categoryService.search({ level: parseInt(level) }, {
                  page: parseInt(page),
                  limit: parseInt(limit),
            });
            
            res.json({
                  status: 'success',
                  data: result,
                  message: `دسته‌های سطح ${level} با موفقیت دریافت شدند`
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// NEW: Get categories by parent
router.get('/parent/:parentId', async (req, res) => {
      try {
            const { parentId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            
            const result = await categoryService.search({ parent_id: parseInt(parentId) }, {
                  page: parseInt(page),
                  limit: parseInt(limit),
            });
            
            res.json({
                  status: 'success',
                  data: result,
                  message: 'زیردسته‌ها با موفقیت دریافت شدند'
            });
      } catch (error) {
            res.status(500).json({ 
                  status: 'error',
                  message: error.message 
            });
      }
});

// NEW: Get category path (breadcrumb) with full details
router.get('/:id/path', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const path = await categoryService.getBreadcrumb(req.params.id);
                  if (!path || path.length === 0) {
                        return res.status(404).json({
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد'
                        });
                  }
                  res.json({
                        status: 'success',
                        data: path,
                        message: 'مسیر دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category descendants
router.get('/:id/descendants', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const descendants = await categoryService._getCategoryAndDescendants(parseInt(req.params.id));
                  const categories = await Category.findAll({
                        where: { id: descendants },
                        attributes: ['id', 'name', 'slug', 'parent_id', 'level', 'order', 'status'],
                        order: [['level', 'ASC'], ['order', 'ASC']],
                  });
                  
                  res.json({
                        status: 'success',
                        data: categories,
                        message: 'زیرمجموعه‌های دسته با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category ancestors
router.get('/:id/ancestors', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const category = await Category.findByPk(req.params.id);
                  if (!category) {
                        return res.status(404).json({
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد'
                        });
                  }

                  if (!category.path || category.path.length === 0) {
                        return res.json({
                              status: 'success',
                              data: [],
                              message: 'این دسته والد ندارد'
                        });
                  }

                  const ancestors = await Category.findAll({
                        where: { id: category.path },
                        attributes: ['id', 'name', 'slug', 'parent_id', 'level'],
                        order: [['level', 'ASC']],
                  });
                  
                  res.json({
                        status: 'success',
                        data: ancestors,
                        message: 'والدهای دسته با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category siblings
router.get('/:id/siblings', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const category = await Category.findByPk(req.params.id);
                  if (!category) {
                        return res.status(404).json({
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد'
                        });
                  }

                  const siblings = await Category.findAll({
                        where: { 
                              parent_id: category.parent_id,
                              id: { [Op.ne]: category.id }
                        },
                        attributes: ['id', 'name', 'slug', 'parent_id', 'level', 'order', 'status'],
                        order: [['order', 'ASC'], ['name', 'ASC']],
                  });
                  
                  res.json({
                        status: 'success',
                        data: siblings,
                        message: 'دسته‌های هم‌سطح با موفقیت دریافت شدند'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category statistics with details
router.get('/:id/statistics', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const stats = await categoryService.getCategoryStats(req.params.id);
                  if (!stats) {
                        return res.status(404).json({
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد'
                        });
                  }
                  res.json({
                        status: 'success',
                        data: stats,
                        message: 'آمار تفصیلی دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

// NEW: Get category with full details including stats
router.get('/:id/full', 
      categoryValidation.getById,
      handleValidationErrors,
      async (req, res) => {
            try {
                  const category = await categoryService.getById(req.params.id, {
                        includeChildren: true,
                        depth: 3,
                        includeStats: true,
                  });
                  
                  if (!category) {
                        return res.status(404).json({
                              status: 'error',
                              message: 'دسته مورد نظر یافت نشد'
                        });
                  }
                  
                  res.json({
                        status: 'success',
                        data: category,
                        message: 'جزئیات کامل دسته با موفقیت دریافت شد'
                  });
            } catch (error) {
                  res.status(500).json({ 
                        status: 'error',
                        message: error.message 
                  });
            }
      }
);

export default router;
