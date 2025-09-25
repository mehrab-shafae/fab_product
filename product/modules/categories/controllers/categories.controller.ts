import { Request, Response } from 'express';
import { categoriesService } from '../services/categories.service.js';

// CRUD
export const createCategory = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.create(req.body);
            res.status(201).json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

export const getCategories = async (req: Request, res: Response) => {
      try {
            const { page, limit, sort, search, ...filters } = req.query;
            // sort باید به صورت {field: جهت} باشد، مثلاً {order: 1}
            let sortObj: any = { createdAt: -1 };
            if (typeof sort === 'string') {
                  try {
                        sortObj = JSON.parse(sort);
                  } catch {
                        sortObj = { [sort]: 1 };
                  }
            }
            const result = await categoriesService.search(
                  { ...filters, search },
                  {
                        page: page ? Number(page) : 1,
                        limit: limit ? Number(limit) : 10,
                        sort: sortObj,
                  }
            );
            res.json({ status: 'success', ...result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const getCategoryTree = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.getTree(req.query);
            res.json({ status: 'success', ...result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const getFeaturedCategories = async (req: Request, res: Response) => {
      try {
            const limit = parseInt(req.query.limit as string) || 10;
            const categories = await categoriesService.getFeaturedCategories(limit);
            res.json({ status: 'success', data: categories });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const searchCategories = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.search(req.query, req.query);
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const advancedSearchCategories = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.advancedSearch(req.query, req.query);
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const getCategoryBySlug = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.getBySlug(req.params.slug, req.query);
            if (!category) return res.status(404).json({ status: 'error', message: 'دسته مورد نظر یافت نشد' });
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const getCategoryById = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.getById(req.params.id, req.query);
            if (!category) return res.status(404).json({ status: 'error', message: 'دسته مورد نظر یافت نشد' });
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const updateCategory = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.update(req.params.id, req.body);
            if (!category) return res.status(404).json({ status: 'error', message: 'دسته مورد نظر یافت نشد' });
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

export const deleteCategory = async (req: Request, res: Response) => {
      try {
            const success = await categoriesService.delete(req.params.id);
            if (!success) return res.status(404).json({ status: 'error', message: 'دسته مورد نظر یافت نشد' });
            res.json({ status: 'success' });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Bulk
export const bulkUpdateCategories = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.bulkUpdate(req.body.categories);
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const bulkDeleteCategories = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.bulkDelete(req.body.categoryIds);
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Breadcrumb, stats, full, descendants, ancestors, siblings
export const getCategoryBreadcrumb = async (req: Request, res: Response) => {
      try {
            const breadcrumb = await categoriesService.getBreadcrumb(req.params.id);
            res.json({ status: 'success', data: breadcrumb });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategoryStats = async (req: Request, res: Response) => {
      try {
            const stats = await categoriesService.getCategoryStats(req.params.id);
            res.json({ status: 'success', data: stats });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategoryStatistics = getCategoryStats;
export const getCategoryFullDetails = getCategoryById;
export const getCategoryDescendants = async (req: Request, res: Response) => {
      try {
            const descendants = await categoriesService.getCategoryDescendants(req.params.id);
            res.json({ status: 'success', data: descendants });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategoryAncestors = async (req: Request, res: Response) => {
      try {
            const ancestors = await categoriesService.getCategoryAncestors(req.params.id);
            res.json({ status: 'success', data: ancestors });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategorySiblings = async (req: Request, res: Response) => {
      try {
            const siblings = await categoriesService.getCategorySiblings(req.params.id);
            res.json({ status: 'success', data: siblings });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Attribute APIs
export const addAttribute = async (req: Request, res: Response) => {
      try {
            const attr = await categoriesService.addAttribute(req.params.categoryId, req.body);
            res.status(201).json({ status: 'success', data: attr });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const getAttributes = async (req: Request, res: Response) => {
      try {
            const attrs = await categoriesService.getAttributes(req.params.categoryId);
            res.json({ status: 'success', data: attrs });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const updateAttribute = async (req: Request, res: Response) => {
      try {
            const attr = await categoriesService.updateAttribute(req.params.attributeId, req.body);
            res.json({ status: 'success', data: attr });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const deleteAttribute = async (req: Request, res: Response) => {
      try {
            const success = await categoriesService.deleteAttribute(req.params.attributeId);
            if (success) res.json({ status: 'success' });
            else res.status(404).json({ status: 'error', message: 'ویژگی مورد نظر یافت نشد' });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const addAttributeOption = async (req: Request, res: Response) => {
      try {
            const opt = await categoriesService.addAttributeOption(req.params.attributeId, req.body.value, req.body.order, req.body.description);
            res.status(201).json({ status: 'success', data: opt });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const getAttributeOptions = async (req: Request, res: Response) => {
      try {
            const options = await categoriesService.getAttributeOptions(req.params.attributeId);
            res.json({ status: 'success', data: options });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const updateAttributeOption = async (req: Request, res: Response) => {
      try {
            const opt = await categoriesService.updateAttributeOption(req.params.optionId, req.body.value, req.body.order, req.body.description);
            res.json({ status: 'success', data: opt });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const deleteAttributeOption = async (req: Request, res: Response) => {
      try {
            const success = await categoriesService.deleteAttributeOption(req.params.optionId);
            if (success) res.json({ status: 'success' });
            else res.status(404).json({ status: 'error', message: 'گزینه مورد نظر یافت نشد' });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Slug redirects
export const addSlugRedirect = async (req: Request, res: Response) => {
      try {
            const { oldSlug } = req.body;
            if (!oldSlug) return res.status(400).json({ status: 'error', message: 'Slug قدیمی الزامی است' });
            const category = await categoriesService.addSlugRedirect(req.params.id, oldSlug);
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const removeSlugRedirect = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.removeSlugRedirect(req.params.id, req.params.oldSlug);
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const getSlugRedirects = async (req: Request, res: Response) => {
      try {
            const redirects = await categoriesService.getSlugRedirects(req.params.id);
            res.json({ status: 'success', data: redirects });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Export/Import
export const exportCategories = async (req: Request, res: Response) => {
      try {
            const { format } = req.params;
            const exportData = await categoriesService.exportCategories(format, req.query);
            res.send(exportData);
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const importCategories = async (req: Request, res: Response) => {
      try {
            const { format, data, options } = req.body;
            const results = await categoriesService.importCategories(format, data, options);
            res.json({ status: 'success', data: results });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

// Clone, template, create from template
export const cloneCategory = async (req: Request, res: Response) => {
      try {
            const { newName, newParentId } = req.body;
            if (!newName) return res.status(400).json({ status: 'error', message: 'نام جدید برای دسته کپی شده الزامی است' });
            const clonedCategory = await categoriesService.cloneCategory(req.params.id, newName, newParentId);
            res.status(201).json({ status: 'success', data: clonedCategory });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategoryTemplate = async (req: Request, res: Response) => {
      try {
            const template = await categoriesService.getCategoryTemplate(req.params.templateId);
            if (!template) return res.status(404).json({ status: 'error', message: 'قالب دسته مورد نظر یافت نشد' });
            res.json({ status: 'success', data: template });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const createFromTemplate = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.createFromTemplate(req.params.templateId, req.body);
            res.status(201).json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

// Approval workflow
export const submitForApproval = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.submitForApproval(req.params.id, req.body);
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const approveCategory = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.approveCategory(req.params.id, req.body);
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};
export const rejectCategory = async (req: Request, res: Response) => {
      try {
            const category = await categoriesService.rejectCategory(req.params.id, req.body);
            res.json({ status: 'success', data: category });
      } catch (error) {
            res.status(400).json({ status: 'error', message: (error as Error).message });
      }
};

// Reorder
export const reorderCategories = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.reorderCategories(req.body.orderedIds);
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// By status, level, parent
export const getCategoriesByStatus = async (req: Request, res: Response) => {
      try {
            const { status } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const result = await categoriesService.search({ status }, { page: Number(page), limit: Number(limit) });
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategoriesByLevel = async (req: Request, res: Response) => {
      try {
            const { level } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const result = await categoriesService.search({ level: Number(level) }, { page: Number(page), limit: Number(limit) });
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getCategoriesByParent = async (req: Request, res: Response) => {
      try {
            const { parentId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const result = await categoriesService.search({ parentId }, { page: Number(page), limit: Number(limit) });
            res.json({ status: 'success', data: result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Analytics
export const getCategoryAnalytics = async (req: Request, res: Response) => {
      try {
            const { dateRange, metrics, groupBy, includeSubcategories, includeProducts, includeAttributes } = req.query;
            const options = {
                  dateRange: dateRange as string,
                  metrics: metrics ? (Array.isArray(metrics) ? (metrics as any[]).map(String) : (metrics as string).split(',').map(String)) : undefined,
                  groupBy: groupBy as string,
                  includeSubcategories: includeSubcategories !== 'false',
                  includeProducts: includeProducts !== 'false',
                  includeAttributes: includeAttributes !== 'false',
            };
            const analytics = await categoriesService.getCategoryAnalytics(req.params.id, options);
            res.json({ status: 'success', data: analytics });
      } catch (error) {
            res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
};
export const getCategoryPerformance = async (req: Request, res: Response) => {
      try {
            const { dateRange, metrics } = req.query;
            const options = {
                  dateRange: dateRange as string,
                  metrics: metrics ? (Array.isArray(metrics) ? (metrics as any[]).map(String) : (metrics as string).split(',').map(String)) : undefined,
            };
            const performance = await categoriesService.getCategoryPerformance(req.params.id, options);
            res.json({ status: 'success', data: performance });
      } catch (error) {
            res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
};
export const getCategoryInsights = async (req: Request, res: Response) => {
      try {
            const { metrics } = req.query;
            const options = {
                  metrics: metrics ? (Array.isArray(metrics) ? (metrics as any[]).map(String) : (metrics as string).split(',').map(String)) : undefined,
            };
            const insights = await categoriesService.getCategoryInsights(req.params.id, options);
            res.json({ status: 'success', data: insights });
      } catch (error) {
            res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
};
export const getCategoryGrowth = async (req: Request, res: Response) => {
      try {
            const { periods, metrics } = req.query;
            const options = {
                  periods: periods ? (Array.isArray(periods) ? (periods as any[]).map(String) : (periods as string).split(',').map(String)) : undefined,
                  metrics: metrics ? (Array.isArray(metrics) ? (metrics as any[]).map(String) : (metrics as string).split(',').map(String)) : undefined,
            };
            const growth = await categoriesService.getCategoryGrowth(req.params.id, options);
            res.json({ status: 'success', data: growth });
      } catch (error) {
            res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
};
export const getHierarchyAnalytics = async (req: Request, res: Response) => {
      try {
            const analytics = await categoriesService.getHierarchyAnalytics(req.query.rootId as string);
            res.json({ status: 'success', data: analytics });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};
export const getComparisonReport = async (req: Request, res: Response) => {
      try {
            const { dateRange, metrics } = req.query;
            const options = {
                  dateRange: dateRange as string,
                  metrics: metrics ? (Array.isArray(metrics) ? (metrics as any[]).map(String) : (metrics as string).split(',').map(String)) : undefined,
            };
            const { categoryIds } = req.body;
            const report = await categoriesService.getComparisonReport(categoryIds, options);
            res.json({ status: 'success', data: report });
      } catch (error) {
            res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
};
export const getLegacyTree = async (_req: Request, res: Response) => {
      try {
            const tree = await categoriesService.getLegacyTree();
            res.json({ status: 'success', data: tree });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const getAllAttributesWithInheritanceController = async (req: Request, res: Response) => {
      try {
            const { categoryId } = req.params;
            const attributes = await categoriesService.getAllAttributesWithInheritance(categoryId);
            res.json({ status: 'success', data: attributes });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const getAttributesAdvanced = async (req: Request, res: Response) => {
      try {
            const { page, limit, sort, search, ...filters } = req.query;
            let sortObj: any = { order: 1 };
            if (typeof sort === 'string') {
                  try {
                        sortObj = JSON.parse(sort);
                  } catch {
                        sortObj = { [sort]: 1 };
                  }
            }
            const result = await categoriesService.getAttributesAdvanced(
                  { ...filters, search },
                  {
                        page: page ? Number(page) : 1,
                        limit: limit ? Number(limit) : 10,
                        sort: sortObj,
                  }
            );
            res.json({ status: 'success', ...result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const bulkUpdateAttributes = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.bulkUpdateAttributes(req.body.attributes);
            res.json({ status: 'success', ...result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

export const bulkDeleteAttributes = async (req: Request, res: Response) => {
      try {
            const result = await categoriesService.bulkDeleteAttributes(req.body.attributeIds);
            res.json({ status: 'success', ...result });
      } catch (error) {
            res.status(500).json({ status: 'error', message: (error as Error).message });
      }
};

// Search categories by attributes
export const searchCategoriesByAttributesController = async (req: Request, res: Response) => {
      try {
            const filters = req.body.filters;
            const slugs = req.body.slugs;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            // Check if at least one of filters or slugs is provided
            if ((!filters || !Array.isArray(filters) || filters.length === 0) && (!slugs || !Array.isArray(slugs) || slugs.length === 0)) {
                  return res.status(400).json({
                        status: 'error',
                        error: 'At least one of filters or slugs must be provided',
                  });
            }

            // Validate filters if provided
            if (filters && Array.isArray(filters) && filters.length > 0) {
                  for (const f of filters) {
                        if (!f.attribute || !Array.isArray(f.values) || f.values.length === 0) {
                              return res.status(400).json({
                                    status: 'error',
                                    error: 'Each filter must have an attribute and a non-empty array of values',
                              });
                        }
                  }
            }

            const results = await categoriesService.searchCategoriesByAttributes(filters, slugs, page, limit);
            res.json({ status: 'success', ...results });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getParentCategoriesWithChildrenAndProductCount = async (_req: Request, res: Response) => {
    try {
        const data = await categoriesService.getParentCategoriesWithChildrenAndProductCount();
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: (error as Error).message });
    }
};
