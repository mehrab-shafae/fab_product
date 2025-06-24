import { Category } from '../models/index.js';
import { body, param, query, validationResult } from 'express-validator';
import { isValidSlug, getSlugConfig } from '../utils/slugGenerator.js';

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

      // Validate category data including slug
      validateCategoryData(req, res, next) {
            const { name, slug, parent_id } = req.body;
            const errors = [];

            // Validate name
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                  errors.push('نام دسته‌بندی الزامی است');
            } else if (name.trim().length < 2) {
                  errors.push('نام دسته‌بندی باید حداقل ۲ کاراکتر باشد');
            } else if (name.trim().length > 255) {
                  errors.push('نام دسته‌بندی نمی‌تواند بیشتر از ۲۵۵ کاراکتر باشد');
            }

            // Validate custom slug if provided
            if (slug && typeof slug === 'string') {
                  if (!isValidSlug(slug)) {
                        const config = getSlugConfig();
                        errors.push(`Slug نامعتبر است. باید بین ${config.MIN_LENGTH} تا ${config.MAX_LENGTH} کاراکتر باشد و فقط شامل حروف، اعداد و خط تیره باشد`);
                  }
            }

            // Validate parent_id
            if (parent_id !== undefined && parent_id !== null) {
                  if (!Number.isInteger(Number(parent_id)) || Number(parent_id) < 0) {
                        errors.push('شناسه دسته‌بندی والد نامعتبر است');
                  }
            }

            if (errors.length > 0) {
                  return res.status(400).json({
                        status: 'error',
                        message: 'خطا در اعتبارسنجی داده‌ها',
                        errors,
                  });
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
                              deleted_at: null,
                        },
                  });

                  if (existingCategory && existingCategory.id !== parseInt(req.params.id)) {
                        return res.error('A category with this name already exists', 409);
                  }

                  next();
            } catch (error) {
                  res.error(error);
            }
      },
};

// Validation rules for category operations
export const categoryValidation = {
      // Create category validation
      create: [
            body('name')
                  .trim()
                  .isLength({ min: 2, max: 255 })
                  .withMessage('نام دسته باید بین 2 تا 255 کاراکتر باشد')
                  .matches(/^[a-zA-Z\u0600-\u06FF\s\-_]+$/)
                  .withMessage('نام دسته فقط می‌تواند شامل حروف، فاصله، خط تیره و زیرخط باشد'),

            body('parent_id').optional().isInt({ min: 1 }).withMessage('شناسه دسته والد باید عدد صحیح مثبت باشد'),

            body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات نمی‌تواند بیشتر از 1000 کاراکتر باشد'),

            body('status').optional().isIn(['active', 'inactive', 'draft', 'archived']).withMessage('وضعیت باید یکی از مقادیر active، inactive، draft یا archived باشد'),

            body('is_featured').optional().isBoolean().withMessage('is_featured باید true یا false باشد'),

            body('order').optional().isInt({ min: 0 }).withMessage('ترتیب باید عدد صحیح غیرمنفی باشد'),

            body('meta_title').optional().isLength({ max: 255 }).withMessage('عنوان متا نمی‌تواند بیشتر از 255 کاراکتر باشد'),

            body('meta_description').optional().isLength({ max: 500 }).withMessage('توضیحات متا نمی‌تواند بیشتر از 500 کاراکتر باشد'),

            body('image_ids').optional().isArray().withMessage('شناسه‌های عکس باید آرایه‌ای از رشته باشند')
                  .custom(arr => arr == null || arr.every(id => typeof id === 'string' && id.trim().length > 0)).withMessage('هر مقدار در image_ids باید رشته غیرخالی باشد'),

            body('attributes').optional().isArray().withMessage('attributes باید آرایه باشد')
                  .custom(arr => {
                        if (!arr) return true;
                        return arr.every(attr => {
                              if (!attr.name || typeof attr.name !== 'string' || attr.name.trim().length === 0) {
                                    return false;
                              }
                              if (!attr.type || !['string', 'number', 'enum'].includes(attr.type)) {
                                    return false;
                              }
                              if (attr.type === 'enum' && (!attr.options || !Array.isArray(attr.options))) {
                                    return false;
                              }
                              return true;
                        });
                  }).withMessage('هر attribute باید دارای name، type و در صورت enum بودن options باشد'),

            //body('icon_url').optional().isURL().withMessage('آدرس آیکون باید URL معتبر باشد'),
      ],

      // Update category validation
      update: [
            param('id').isInt({ min: 1 }).withMessage('شناسه دسته باید عدد صحیح مثبت باشد'),

            body('name')
                  .optional()
                  .trim()
                  .isLength({ min: 2, max: 255 })
                  .withMessage('نام دسته باید بین 2 تا 255 کاراکتر باشد')
                  .matches(/^[a-zA-Z\u0600-\u06FF\s\-_]+$/)
                  .withMessage('نام دسته فقط می‌تواند شامل حروف، فاصله، خط تیره و زیرخط باشد'),

            body('parent_id').optional().isInt({ min: 1 }).withMessage('شناسه دسته والد باید عدد صحیح مثبت باشد'),

            body('description').optional().isLength({ max: 1000 }).withMessage('توضیحات نمی‌تواند بیشتر از 1000 کاراکتر باشد'),

            body('status').optional().isIn(['active', 'inactive', 'draft', 'archived']).withMessage('وضعیت باید یکی از مقادیر active، inactive، draft یا archived باشد'),

            body('is_featured').optional().isBoolean().withMessage('is_featured باید true یا false باشد'),

            body('order').optional().isInt({ min: 0 }).withMessage('ترتیب باید عدد صحیح غیرمنفی باشد'),

            body('attributes').optional().isArray().withMessage('attributes باید آرایه باشد')
                  .custom(arr => {
                        if (!arr) return true;
                        return arr.every(attr => {
                              if (!attr.name || typeof attr.name !== 'string' || attr.name.trim().length === 0) {
                                    return false;
                              }
                              if (!attr.type || !['string', 'number', 'enum'].includes(attr.type)) {
                                    return false;
                              }
                              if (attr.type === 'enum' && (!attr.options || !Array.isArray(attr.options))) {
                                    return false;
                              }
                              return true;
                        });
                  }).withMessage('هر attribute باید دارای name، type و در صورت enum بودن options باشد'),

            //body('icon_url').optional().isURL().withMessage('آدرس آیکون باید URL معتبر باشد'),
      ],

      // Get category validation
      getById: [param('id').isInt({ min: 1 }).withMessage('شناسه دسته باید عدد صحیح مثبت باشد')],

      // Search validation
      search: [
            query('page').optional().isInt({ min: 1 }).withMessage('شماره صفحه باید عدد صحیح مثبت باشد'),

            query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('تعداد آیتم‌ها باید بین 1 تا 100 باشد'),

            query('status').optional().isIn(['active', 'inactive', 'draft', 'archived']).withMessage('وضعیت باید یکی از مقادیر active، inactive، draft یا archived باشد'),

            query('is_featured').optional().isBoolean().withMessage('is_featured باید true یا false باشد'),

            query('parent_id').optional().isInt({ min: 1 }).withMessage('شناسه دسته والد باید عدد صحیح مثبت باشد'),
      ],

      // Bulk operations validation
      bulkUpdate: [
            body('categories').isArray({ min: 1, max: 100 }).withMessage('categories باید آرایه‌ای با حداقل 1 و حداکثر 100 آیتم باشد'),

            body('categories.*.id').isInt({ min: 1 }).withMessage('شناسه هر دسته باید عدد صحیح مثبت باشد'),

            body('categories.*.name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('نام دسته باید بین 2 تا 255 کاراکتر باشد'),
      ],

      // Reorder validation
      reorder: [body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds باید آرایه‌ای غیرخالی باشد'), body('orderedIds.*').isInt({ min: 1 }).withMessage('هر شناسه در orderedIds باید عدد صحیح مثبت باشد')],

      // Attribute validation
      attribute: [
            body('name').trim().isLength({ min: 2, max: 100 }).withMessage('نام ویژگی باید بین 2 تا 100 کاراکتر باشد'),

            body('type').isIn(['text', 'number', 'boolean', 'date', 'enum', 'file', 'color', 'size']).withMessage('نوع ویژگی باید یکی از مقادیر معتبر باشد'),

            body('required').optional().isBoolean().withMessage('required باید true یا false باشد'),

            body('order').optional().isInt({ min: 0 }).withMessage('ترتیب باید عدد صحیح غیرمنفی باشد'),

            body('options').optional().isArray().withMessage('options باید آرایه باشد'),

            body('options.*.value').optional().isLength({ min: 1, max: 100 }).withMessage('مقدار هر گزینه باید بین 1 تا 100 کاراکتر باشد'),
      ],

      // Clone category validation
      clone: [
            param('id').isInt({ min: 1 }).withMessage('شناسه دسته باید عدد صحیح مثبت باشد'),

            body('newName')
                  .trim()
                  .isLength({ min: 2, max: 255 })
                  .withMessage('نام جدید دسته باید بین 2 تا 255 کاراکتر باشد')
                  .matches(/^[a-zA-Z\u0600-\u06FF\s\-_]+$/)
                  .withMessage('نام جدید دسته فقط می‌تواند شامل حروف، فاصله، خط تیره و زیرخط باشد'),

            body('newParentId').optional().isInt({ min: 1 }).withMessage('شناسه دسته والد جدید باید عدد صحیح مثبت باشد'),
      ],

      // Approval validation
      approval: [param('id').isInt({ min: 1 }).withMessage('شناسه دسته باید عدد صحیح مثبت باشد'), body('submittedBy').isInt({ min: 1 }).withMessage('شناسه کاربر ارسال‌کننده باید عدد صحیح مثبت باشد')],

      // Approve validation
      approve: [param('id').isInt({ min: 1 }).withMessage('شناسه دسته باید عدد صحیح مثبت باشد'), body('approvedBy').isInt({ min: 1 }).withMessage('شناسه کاربر تاییدکننده باید عدد صحیح مثبت باشد')],

      // Reject validation
      reject: [
            param('id').isInt({ min: 1 }).withMessage('شناسه دسته باید عدد صحیح مثبت باشد'),

            body('rejectedBy').isInt({ min: 1 }).withMessage('شناسه کاربر ردکننده باید عدد صحیح مثبت باشد'),

            body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('دلیل رد کردن باید بین 5 تا 500 کاراکتر باشد'),
      ],

      // Comparison validation
      comparison: [body('categoryIds').isArray({ min: 2, max: 10 }).withMessage('categoryIds باید آرایه‌ای با حداقل 2 و حداکثر 10 آیتم باشد'), body('categoryIds.*').isInt({ min: 1 }).withMessage('هر شناسه در categoryIds باید عدد صحیح مثبت باشد')],

      // Export validation
      export: [param('format').isIn(['csv', 'json', 'xml']).withMessage('فرمت باید یکی از مقادیر csv، json یا xml باشد')],

      // Import validation
      import: [body('format').isIn(['csv', 'json', 'xml']).withMessage('فرمت باید یکی از مقادیر csv، json یا xml باشد'), body('data').isArray({ min: 1 }).withMessage('data باید آرایه‌ای غیرخالی باشد')],
};

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
            return res.status(400).json({
                  status: 'error',
                  message: 'خطا در اعتبارسنجی داده‌ها',
                  errors: errors.array().map(error => ({
                        field: error.path,
                        message: error.msg,
                        value: error.value,
                  })),
                  requestId: (typeof getRequestId === 'function' ? getRequestId(req) : (req.requestId || null)),
            });
      }
      next();
};

// Middleware to validate slug parameter
export const validateSlugParam = (req, res, next) => {
      const { slug } = req.params;

      if (!slug || typeof slug !== 'string') {
            return res.status(400).json({
                  status: 'error',
                  message: 'Slug نامعتبر است',
            });
      }

      if (!isValidSlug(slug)) {
            return res.status(400).json({
                  status: 'error',
                  message: 'فرمت slug نامعتبر است',
            });
      }

      next();
};

// Middleware to check if category exists
export const checkCategoryExists = async (req, res, next) => {
      try {
            const { id } = req.params;
            const { Category } = await import('../models/index.js');

            const category = await Category.findByPk(id);
            if (!category) {
                  return res.status(404).json({
                        status: 'error',
                        message: 'دسته مورد نظر یافت نشد',
                  });
            }

            req.category = category;
            next();
      } catch (error) {
            next(error);
      }
};

// Middleware to check if parent category exists
export const checkParentCategoryExists = async (req, res, next) => {
      try {
            const { parent_id } = req.body;
            if (!parent_id) return next();

            const { Category } = await import('../models/index.js');

            const parentCategory = await Category.findByPk(parent_id);
            if (!parentCategory) {
                  return res.status(404).json({
                        status: 'error',
                        message: 'دسته والد مورد نظر یافت نشد',
                  });
            }

            req.parentCategory = parentCategory;
            next();
      } catch (error) {
            next(error);
      }
};

// Middleware to prevent circular references
export const preventCircularReference = async (req, res, next) => {
      try {
            const { id } = req.params;
            const { parent_id } = req.body;

            if (!parent_id || !id) return next();

            if (parseInt(id) === parseInt(parent_id)) {
                  return res.status(400).json({
                        status: 'error',
                        message: 'دسته نمی‌تواند والد خودش باشد',
                  });
            }

            // Check if the new parent is a descendant of current category
            const { Category } = await import('../models/index.js');
            const descendants = await getCategoryDescendants(parseInt(id));

            if (descendants.includes(parseInt(parent_id))) {
                  return res.status(400).json({
                        status: 'error',
                        message: 'دسته والد نمی‌تواند زیرمجموعه دسته فعلی باشد',
                  });
            }

            next();
      } catch (error) {
            next(error);
      }
};

// Helper function to get category descendants
async function getCategoryDescendants(categoryId) {
      const { Category } = await import('../models/index.js');

      const descendants = [];
      const queue = [categoryId];

      while (queue.length > 0) {
            const currentId = queue.shift();
            const children = await Category.findAll({
                  where: { parent_id: currentId },
            });

            for (const child of children) {
                  descendants.push(child.id);
                  queue.push(child.id);
            }
      }

      return descendants;
}

// Middleware to check category permissions (for future use)
export const checkCategoryPermissions = permission => {
      return (req, res, next) => {
            // Basic permission checking logic
            // In a real application, you would check user roles and permissions
            const user = req.user;

            if (!user) {
                  return res.status(401).json({
                        status: 'error',
                        message: 'Authentication required',
                  });
            }

            // Define permissions for different operations
            const permissions = {
                  create: ['admin', 'manager', 'editor'],
                  update: ['admin', 'manager', 'editor'],
                  delete: ['admin', 'manager'],
                  approve: ['admin', 'manager'],
                  reject: ['admin', 'manager'],
                  view: ['admin', 'manager', 'editor', 'viewer'],
            };

            const allowedRoles = permissions[permission] || [];

            if (!allowedRoles.includes(user.role)) {
                  return res.status(403).json({
                        status: 'error',
                        message: 'Insufficient permissions',
                  });
            }

            next();
      };
};

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map();

// Middleware to rate limit category operations
export const categoryRateLimit = (req, res, next) => {
      const ip = req.ip;
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutes
      const maxRequests = 100; // Max 100 requests per window

      const key = `rate_limit:${ip}`;
      const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

      // Reset if window has passed
      if (now > current.resetTime) {
            current.count = 0;
            current.resetTime = now + windowMs;
      }

      // Check if limit exceeded
      if (current.count >= maxRequests) {
            return res.status(429).json({
                  status: 'error',
                  message: 'Too many requests, please try again later',
            });
      }

      // Increment counter
      current.count++;
      rateLimitStore.set(key, current);

      // Clean up old entries (simple cleanup)
      if (Math.random() < 0.01) {
            // 1% chance to cleanup
            for (const [key, value] of rateLimitStore.entries()) {
                  if (now > value.resetTime) {
                        rateLimitStore.delete(key);
                  }
            }
      }

      next();
};

// Simple logging implementation (in production, use a proper logging library)
// const logToFile = logData => {
//       // const fs = require('fs');
//       // const path = require('path');

//       const logDir = path.join(process.cwd(), 'logs');
//       if (!fs.existsSync(logDir)) {
//             fs.mkdirSync(logDir, { recursive: true });
//       }

//       const logFile = path.join(logDir, 'category-operations.log');
//       const timestamp = new Date().toISOString();
//       const logEntry = `${timestamp} - ${JSON.stringify(logData)}\n`;

//       fs.appendFileSync(logFile, logEntry);
// };

// Middleware to log category operations
export const logCategoryOperation = operation => {
      return (req, res, next) => {
            const logData = {
                  operation,
                  categoryId: req.params.id,
                  userId: req.user?.id || 'anonymous',
                  timestamp: new Date(),
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  method: req.method,
                  path: req.path,
                  body: req.body,
                  query: req.query,
            };

            // Log to file
            // try {
            //       logToFile(logData);
            // } catch (error) {
            //       console.error('Failed to log category operation:', error);
            // }

            // Also log to console for development
            console.log('Category operation:', {
                  operation: logData.operation,
                  categoryId: logData.categoryId,
                  userId: logData.userId,
                  timestamp: logData.timestamp,
            });

            next();
      };
};
