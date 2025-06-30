import 'dotenv/config';
import '../cwd.js';
// ======================================================================
import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { readFileSync } from 'fs';
import { createLogger, format, transports } from 'winston';
import helmet from 'helmet';
import YAML from 'yamljs';
import { sequelize, seedDefaultLanguages } from './models/index.js';
import categoryRoutes from './routes/categoryRoutes.js';
import i18nRoutes from './routes/i18nRoutes.js';
import { Category, CategoryAttribute, CategoryAttributeOption, ProductAttributeValue } from './models/index.js';
import { i18nMiddleware, validateLanguageMiddleware, addLanguageInfoMiddleware, translationFallbackMiddleware } from './middlewares/i18nMiddleware.js';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';

// ======================================================================
const schemaConfig = JSON.parse(readFileSync(cwd('product/database-schema.json'), 'utf8'));

const PORT = 7001;
const POSTGRES_URI = process.env.POSTGRES_URI || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'product_db'}`;

const { combine, timestamp, printf, colorize } = format;

const DB_ERROR_CODES = {
      23503: {
            categories: {
                  parent_id_fkey: 'The specified parent category does not exist',
                  default: 'Referenced record does not exist',
            },
            products: {
                  category_id_fkey: 'The specified category does not exist',
                  default: 'Referenced record does not exist',
            },
            default: 'Referenced record does not exist',
      },

      23505: {
            categories: {
                  categories_name_key: 'A category with this name already exists',
                  default: 'This record already exists',
            },
            products: {
                  products_sku_key: 'A product with this SKU already exists',
                  default: 'This record already exists',
            },
            default: 'This record already exists',
      },

      23502: {
            categories: {
                  name: 'Category name is required',
                  default: 'Required field is missing',
            },
            products: {
                  name: 'Product name is required',
                  price: 'Product price is required',
                  default: 'Required field is missing',
            },
            default: 'Required field is missing',
      },

      23514: {
            products: {
                  products_price_check: 'Product price must be greater than 0',
                  default: 'Invalid value provided',
            },
            default: 'Invalid value provided',
      },
};

// =====================[ Logger Enhancement ]=====================
const logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(
            timestamp(),
            printf(({ level, message, timestamp, requestId, ...metadata }) => {
                  let msg = `${timestamp} [${level}]`;
                  if (requestId) msg += ` [${requestId}]`;
                  msg += ` : ${message}`;
                  if (Object.keys(metadata).length > 0) {
                        msg += JSON.stringify(metadata);
                  }
                  return msg;
            })
      ),
      transports: [
            new transports.Console({
                  format: combine(
                        colorize(),
                        timestamp(),
                        printf(({ level, message, timestamp, requestId, ...metadata }) => {
                              let msg = `${timestamp} [${level}]`;
                              if (requestId) msg += ` [${requestId}]`;
                              msg += ` : ${message}`;
                              if (Object.keys(metadata).length > 0) {
                                    msg += JSON.stringify(metadata);
                              }
                              return msg;
                        })
                  ),
            }),
            new transports.File({
                  filename: 'error.log',
                  level: 'error',
                  format: combine(
                        timestamp(),
                        printf(({ level, message, timestamp, requestId, ...metadata }) => {
                              let msg = `${timestamp} [${level}]`;
                              if (requestId) msg += ` [${requestId}]`;
                              msg += ` : ${message}`;
                              if (Object.keys(metadata).length > 0) {
                                    msg += JSON.stringify(metadata);
                              }
                              return msg;
                        })
                  ),
            }),
            new transports.File({
                  filename: 'combined.log',
                  format: combine(
                        timestamp(),
                        printf(({ level, message, timestamp, requestId, ...metadata }) => {
                              let msg = `${timestamp} [${level}]`;
                              if (requestId) msg += ` [${requestId}]`;
                              msg += ` : ${message}`;
                              if (Object.keys(metadata).length > 0) {
                                    msg += JSON.stringify(metadata);
                              }
                              return msg;
                        })
                  ),
            }),
      ],
});

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const isDevelopment = process.env.NODE_ENV === 'development';

const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: isDevelopment ? 0 : 250,
      message: 'Too many requests from this IP, please try again later.',
});

const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000,
      delayAfter: isDevelopment ? 100 : 50,
      delayMs: (used, req) => {
            const baseDelay = (used - req.slowDown.limit) * (isDevelopment ? 250 : 500);

            const methodMultiplier =
                  {
                        GET: 0.5,
                        POST: 2.0,
                        PUT: 1.5,
                        DELETE: 1.5,
                        PATCH: 1.5,
                  }[req.method] || 1.0;

            const hasCaching = req.originalUrl.includes('/products/') || req.originalUrl.includes('/categories/') || req.originalUrl.includes('/search') || req.originalUrl.includes('/analytics');

            const cacheMultiplier = hasCaching ? 0.3 : 1.0;

            const finalDelay = Math.floor(baseDelay * methodMultiplier * cacheMultiplier);

            return hasCaching ? finalDelay : Math.max(finalDelay, isDevelopment ? 100 : 200);
      },
      keyGenerator: req => {
            const routePattern = req.originalUrl.split('/')[1];
            return `${req.ip}:${routePattern}`;
      },
      // skip: (req) => {
      //     // Skip rate limiting for certain paths or conditions
      //     return req.path.startsWith('/health') ||
      //            req.path.startsWith('/metrics') ||
      //            req.path.startsWith('/docs');
      // }
});

const swaggerDocument = YAML.parse(readFileSync(cwd('product/swagger.yaml'), 'utf8'));

const pgPool = new Pool({
      connectionString: POSTGRES_URI,
});

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT_FIELD = 'created_at';
const DEFAULT_SORT_ORDER = 'DESC';

// ======================================================================
logger.debug = function (message, metadata = {}) {
      if (DEBUG_MODE) {
            this.info(message, { ...metadata, debug: true });
      }
};

swaggerDocument.info.title = 'Product Microservice API';
swaggerDocument.info.description = 'API for managing products and related features';
swaggerDocument.servers[0].description = 'Development server';

// ======================================================================

const responseHandler = (req, res, next) => {
      res.success = (data, message = 'Success') => {
            // اگر اطلاعات زبان در res.locals وجود داشت، به خروجی اضافه کن
            if (res.locals.languages && res.locals.currentLanguage) {
                  res.json({
                        status: 'success',
                        data,
                        message,
                        language: {
                              code: req.languageCode,
                              name: res.locals.currentLanguage?.name,
                              native_name: res.locals.currentLanguage?.native_name,
                              direction: res.locals.currentLanguage?.direction,
                        },
                        availableLanguages: res.locals.languages.map(lang => ({
                              code: lang.code,
                              name: lang.name,
                              native_name: lang.native_name,
                              is_default: lang.is_default,
                              direction: lang.direction,
                        })),
                  });
            } else {
                  res.json({
                        status: 'success',
                        data,
                        message,
                  });
            }
      };

      res.error = (error, statusCode = 500) => {
            if (typeof error === 'string') {
                  return res.status(statusCode).json({
                        status: 'error',
                        message: error,
                        data: null,
                  });
            }

            logger.error('response Error', { error });
            const handledError = handleDatabaseError(error);

            // اگر پیام خطا کلی بود، پیام اختصاصی constraint را جایگزین کن
            const genericMessages = ['Validation error', 'This record already exists', 'Referenced record does not exist', 'Required field is missing', 'Invalid value provided'];
            let message = handledError.message;
            if (genericMessages.includes(message) && error.detail) {
                  // اگر دیتیل خطا وجود دارد، آن را نمایش بده
                  message = error.detail;
            } else if (genericMessages.includes(message) && error.constraint) {
                  // اگر constraint وجود دارد، پیام اختصاصی constraint را نمایش بده
                  message = `Constraint violation: ${error.constraint}`;
            }

            res.status(handledError.statusCode).json({
                  status: 'error',
                  message,
                  data: null,
                  ...(handledError.details && { details: handledError.details }),
            });
      };

      next();
};

async function init() {
      const app = express();

      const apiV1Router = express.Router();

      if (isDevelopment) {
            // Configure Helmet with CSP that allows inline scripts for admin panel
            app.use(
                  helmet({
                        contentSecurityPolicy: {
                              directives: {
                                    defaultSrc: ["'self'"],
                                    scriptSrc: ["'self'", "'unsafe-inline'"],
                                    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
                                    scriptSrcAttr: ["'unsafe-inline'"],
                                    imgSrc: ["'self'", 'data:', 'https:'],
                                    connectSrc: ["'self'"],
                                    fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
                                    objectSrc: ["'none'"],
                                    mediaSrc: ["'self'"],
                                    frameSrc: ["'none'"],
                                    workerSrc: ["'self'"],
                                    manifestSrc: ["'self'"],
                                    baseUri: ["'self'"],
                                    formAction: ["'self'"],
                                    frameAncestors: ["'none'"],
                                    upgradeInsecureRequests: [],
                              },
                        },
                        crossOriginEmbedderPolicy: false,
                        crossOriginResourcePolicy: { policy: 'cross-origin' },
                  })
            );
      } else {
            app.use(helmet());
      }

      app.use(
            cors({
                  origin: ['http://localhost:3000'],
                  credentials: true,
            })
      );
      app.use(express.json({ limit: '1mb' }));
      app.use(express.urlencoded({ limit: '1mb', extended: true }));
      if (!isDevelopment) {
            app.use(limiter);
            app.use(speedLimiter);
      }

      // Add i18n middleware
      app.use(i18nMiddleware);
      app.use(validateLanguageMiddleware);
      app.use(addLanguageInfoMiddleware);
      app.use(translationFallbackMiddleware);

      app.use(requestLogger);
      app.use(errorLogger);

      app.use(
            '/api-docs/en',
            swaggerUi.serve,
            swaggerUi.setup(swaggerDocument, {
                  customCss: '.swagger-ui .topbar { display: none }',
                  customSiteTitle: 'API Documentation',
                  swaggerOptions: {
                        persistAuthorization: true,
                        docExpansion: 'none',
                        filter: true,
                        showExtensions: true,
                        showCommonExtensions: true,
                        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                        displayRequestDuration: true,
                        deepLinking: true,
                        defaultModelsExpandDepth: 3,
                        defaultModelExpandDepth: 3,
                        defaultModelRendering: 'model',
                        displayOperationId: false,
                        filter: true,
                        maxDisplayedTags: 10,
                        showExtensions: true,
                        showCommonExtensions: true,
                        syntaxHighlight: {
                              activated: true,
                              theme: 'monokai',
                        },
                        tryItOutEnabled: true,
                  },
            })
      );

      app.get('/api-docs', (req, res) => res.redirect('/api-docs/en'));

      app.use(responseHandler);

      app.get('/health', healthCheckController);

      try {
            // Initialize Sequelize
            await sequelize.authenticate();
            console.log('Sequelize connection has been established successfully.');

            // Create database schema first
            await createDatabaseSchema();
            console.log('Database schema created successfully.');

            // Seed default languages (fa, en, ar)
            await seedDefaultLanguages();

            // Sync models with database - use force: false to preserve existing data
            // and alter: false to not modify existing tables
            try {
                  await sequelize.sync({ alter: false, force: false });
                  console.log('Database synchronized successfully.');
            } catch (syncError) {
                  console.log('Sequelize sync had some issues, but continuing with existing database structure...');
                  console.log('Sync error details:', syncError.message);
            }

            // Create materialized views and indexes
            await createMaterializedViews();
            await createMaterializedViewIndexes();
            await refreshMaterializedViews();
            await createOptimizedIndexes();

            scheduleMaterializedViewRefresh();

            console.log('Database initialization completed successfully');
      } catch (error) {
            console.error('Initialization failed:', error);
            process.exit(1);
      }

      apiV1Routers(apiV1Router);

      app.use('/api/product/v1', apiV1Router);

      app.use('/api/i18n', i18nRoutes);

      app.use((err, req, res, next) => {
            logger.error('Unhandled error', {
                  error: err.message,
                  stack: err.stack,
            });
            res.status(500).json({
                  error: 'Internal server error',
                  message: process.env.NODE_ENV === 'development' ? err.message : undefined,
            });
      });

      app.listen(PORT, function () {
            console.log(`Product service is running on port ${PORT}`);
            console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
            // Start PGUi worker after successful startup
            startPguiWorker();
      });
}

function apiV1Routers(app) {
      app.post('/products', validateRequiredFieldsMiddleware(['name', 'price', 'description']), requestLogger, createProductController);
      app.post('/products/:productId/comments', validateRequiredFieldsMiddleware(['content', 'user_id']), validateProductIdMiddleware, requestLogger, addCommentController);
      app.post('/products/:productId/tags', validateRequiredFieldsMiddleware(['tag_name']), validateProductIdMiddleware, requestLogger, addTagToProductController);
      app.post('/products/:productId/chats', validateProductIdMiddleware, requestLogger, createProductChatController);
      app.post('/chats/:chatId/messages', validateRequiredFieldsMiddleware(['content', 'user_id']), requestLogger, addChatMessageController);
      app.post('/chats/:chatId/read', validateRequiredFieldsMiddleware(['user_id']), requestLogger, markChatMessagesAsReadController);
      app.post('/products/:productId/images', validateRequiredFieldsMiddleware(['image_id', 'alt_text']), validateProductIdMiddleware, requestLogger, addProductImageController);
      app.post('/products/:productId/variants', validateRequiredFieldsMiddleware(['name', 'price', 'sku']), validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, createProductVariantController);
      app.post('/products/:productId/inventory', validateRequiredFieldsMiddleware(['quantity', 'variant_id']), validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, updateInventoryController);
      app.post('/products/:productId/reviews', validateRequiredFieldsMiddleware(['rating', 'content', 'user_id']), validateProductIdMiddleware, requestLogger, addProductReviewController);
      app.post('/users/:userId/wishlist', validateRequiredFieldsMiddleware(['product_id']), requestLogger, addToWishlistController);
      app.post('/products/:productId/attributes', validateRequiredFieldsMiddleware(['attribute_id', 'value']), validateProductIdMiddleware, requestLogger, addProductAttributeController);
      app.post('/attributes', validateRequiredFieldsMiddleware(['name', 'type']), requestLogger, createAttributeController);
      app.post('/products/:productId/price-history', validateRequiredFieldsMiddleware(['price', 'variant_id']), validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, addPriceHistoryController);
      app.post('/products/:productId/relationships', validateRequiredFieldsMiddleware(['related_product_id', 'relationship_type']), validateProductIdMiddleware, requestLogger, addProductRelationshipController);
      app.post('/products/:productId/versions', validateRequiredFieldsMiddleware(['version_number', 'changes']), validateProductIdMiddleware, requestLogger, createProductVersionController);

      app.get('/products', paginateResults, requestLogger, searchProductsController);
      app.get('/products/:id', validateProductIdMiddleware, requestLogger, getProductByIdController);
      app.get('/products/:productId/comments', validateProductIdMiddleware, paginateResults, requestLogger, getProductCommentsController);
      app.get('/products/tags/:tagName', paginateResults, requestLogger, getProductsByTagController);
      app.get('/products/search/document', validateRequiredFieldsMiddleware(['q']), paginateResults, requestLogger, searchProductDocumentsController);
      app.get('/users/:userId/chats', paginateResults, requestLogger, getUserChatsController);
      app.get('/chats/:chatId/messages', paginateResults, requestLogger, getChatMessagesController);
      app.get('/products/statistics', requestLogger, getProductStatisticsController);
      app.get('/products/:productId/analytics', validateProductIdMiddleware, requestLogger, getProductAnalyticsController);
      app.get('/products/:productId/attributes', validateProductIdMiddleware, requestLogger, getProductAttributesController);
      app.get('/products/:productId/price-history', validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, getProductPriceHistoryController);
      app.get('/products/:productId/price-statistics', validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, getProductPriceStatisticsController);
      app.get('/products/:productId/variants', validateProductIdMiddleware, requestLogger, getProductVariantsController);
      app.get('/products/:productId/images', validateProductIdMiddleware, requestLogger, getProductImagesController);
      app.get('/products/:productId/reviews', paginateResults, validateProductIdMiddleware, requestLogger, getProductReviewsController);
      app.get('/users/:userId/wishlist', paginateResults, requestLogger, getWishlistController);
      app.get('/products/:id/price-trends', validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, getPriceTrendsController);
      app.get('/products/:productId/relationships', validateProductIdMiddleware, requestLogger, getProductRelationshipsController);
      app.get('/products/:productId/versions', validateProductIdMiddleware, requestLogger, getProductVersionsController);

      app.put('/products/:id', validateRequiredFieldsMiddleware(['name', 'price', 'description']), validateProductIdMiddleware, requestLogger, updateProductController);

      app.delete('/products/:id', validateProductIdMiddleware, requestLogger, deleteProductController);

      app.patch('/products/:id/status', validateRequiredFieldsMiddleware(['status']), validateProductIdMiddleware, requestLogger, updateProductStatusController);
      app.patch('/products/bulk-status', validateRequiredFieldsMiddleware(['productIds', 'status']), requestLogger, bulkUpdateProductStatusController);

      app.use('/categories', categoryRoutes);
}

function createProduct(productData) {
      const { name, description, price, category_id, metadata } = productData;

      if (!name || !price) {
            throw new Error('Name and price are required fields');
      }

      if (typeof price !== 'number' || price <= 0) {
            throw new Error('Price must be a positive number');
      }

      if (category_id !== undefined && category_id !== null) {
            if (!Number.isInteger(Number(category_id)) || Number(category_id) <= 0) {
                  throw new Error('Category ID must be a positive integer');
            }
      }

      const query = `
        INSERT INTO products (name, description, price, category_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
      return pgPool.query(query, [name, description, price, category_id || null, metadata]);
}

function getProductById(id) {
      return pgPool.query('SELECT * FROM products WHERE id = $1', [id]);
}

function addComment(commentData) {
      const { product_id, user_id, comment } = commentData;
      const query = `
        INSERT INTO product_comments (product_id, user_id, comment)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, user_id, comment]);
}

function getProductComments(product_id, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      const query = `
        SELECT pc.*, COUNT(*) OVER() as total_count
        FROM product_comments pc
        WHERE pc.product_id = $1
        ORDER BY pc.created_at DESC
        LIMIT $2 OFFSET $3
    `;
      return pgPool.query(query, [product_id, limit, offset]);
}

function addTagToProduct(product_id, tag_name) {
      const query = `
        INSERT INTO product_tags (product_id, tag_name)
        VALUES ($1, $2)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, tag_name]);
}

function getProductsByTag(tag_name, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      const query = `
        SELECT p.*, COUNT(*) OVER() as total_count
        FROM products p
        JOIN product_tags pt ON p.id = pt.product_id
        WHERE pt.tag_name = $1
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
    `;
      return pgPool.query(query, [tag_name, limit, offset]);
}

function createProductChat(chatData) {
      const { product_id, user_id, seller_id } = chatData;
      const query = `
        INSERT INTO product_chats (product_id, user_id, seller_id)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, user_id, seller_id]);
}

function getProductChats(user_id, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      const query = `
        SELECT pc.*, COUNT(*) OVER() as total_count
        FROM product_chats pc
        WHERE pc.user_id = $1
        ORDER BY pc.created_at DESC
        LIMIT $2 OFFSET $3
    `;
      return pgPool.query(query, [user_id, limit, offset]);
}

function addChatMessage(messageData) {
      const { chat_id, sender_id, message } = messageData;
      const query = `
        INSERT INTO chat_messages (chat_id, sender_id, message)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
      return pgPool.query(query, [chat_id, sender_id, message]);
}

function getChatMessages(chat_id, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      const query = `
        SELECT cm.*, COUNT(*) OVER() as total_count
        FROM chat_messages cm
        WHERE cm.chat_id = $1
        ORDER BY cm.created_at ASC
        LIMIT $2 OFFSET $3
    `;
      return pgPool.query(query, [chat_id, limit, offset]);
}

// =====================[ handleDatabaseError Enhancement ]=====================
function handleDatabaseError(error) {
      if (!error.code || !DB_ERROR_CODES[error.code]) {
            return {
                  message: error.message,
                  statusCode: 500,
                  errorCode: 'INTERNAL_ERROR',
            };
      }
      const errorConfig = DB_ERROR_CODES[error.code];
      let message = errorConfig.default;
      let statusCode = 400;
      let errorCode = error.code;
      if (error.table && errorConfig[error.table]) {
            if (error.constraint && errorConfig[error.table][error.constraint]) {
                  message = errorConfig[error.table][error.constraint];
            } else if (errorConfig[error.table].default) {
                  message = errorConfig[error.table].default;
            }
      }
      switch (error.code) {
            case '23503':
                  statusCode = 404;
                  break;
            case '23505':
                  statusCode = 409;
                  break;
            case '23502':
            case '23514':
                  statusCode = 400;
                  break;
            default:
                  statusCode = 500;
      }
      return {
            message,
            statusCode,
            errorCode,
            details:
                  process.env.NODE_ENV === 'development'
                        ? {
                                code: error.code,
                                table: error.table,
                                constraint: error.constraint,
                          }
                        : undefined,
      };
}

function markChatMessagesAsRead(chat_id, user_id) {
      const query = `
        UPDATE chat_messages 
        SET is_read = true 
        WHERE chat_id = $1 AND sender_id != $2 AND is_read = false
        RETURNING *
    `;
      return pgPool.query(query, [chat_id, user_id]);
}

function getProductAnalytics(productId) {
      const query = `
        WITH product_stats AS (
            SELECT 
                p.id,
                p.name,
                COUNT(DISTINCT pc.user_id) as unique_viewers,
                COUNT(DISTINCT pt.tag_name) as tag_count,
                COUNT(DISTINCT pcm.id) as comment_count,
                COUNT(DISTINCT pch.id) as chat_count,
                AVG(p.price) as avg_price,
                MIN(p.price) as min_price,
                MAX(p.price) as max_price
            FROM products p
            LEFT JOIN product_comments pc ON p.id = pc.product_id
            LEFT JOIN product_tags pt ON p.id = pt.product_id
            LEFT JOIN product_comments pcm ON p.id = pcm.product_id
            LEFT JOIN product_chats pch ON p.id = pch.product_id
            WHERE p.id = $1
            GROUP BY p.id, p.name
        )
        SELECT 
            ps.*,
            c.name as category_name,
            (
                SELECT json_agg(tag_data)
                FROM (
                    SELECT pt.tag_name, COUNT(*) as usage_count
                    FROM product_tags pt
                    WHERE pt.product_id = $1
                    GROUP BY pt.tag_name
                    ORDER BY usage_count DESC
                ) tag_data
            ) as tag_analytics,
            (
                SELECT json_agg(comment_data)
                FROM (
                    SELECT 
                        pc.user_id,
                        pc.comment,
                        pc.created_at
                    FROM product_comments pc
                    WHERE pc.product_id = $1
                    ORDER BY pc.created_at DESC
                    LIMIT 10
                ) comment_data
            ) as recent_comments
        FROM product_stats ps
        LEFT JOIN categories c ON ps.id = c.id
    `;
      return pgPool.query(query, [productId]);
}

function createProductVariant(variantData) {
      const { product_id, sku, name, price, stock_quantity, attributes } = variantData;
      const query = `
        INSERT INTO product_variants (product_id, sku, name, price, stock_quantity, attributes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, sku, name, price, stock_quantity, attributes]);
}

function getProductVariants(product_id) {
      return pgPool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY created_at DESC', [product_id]);
}

function addProductImage(imageData) {
      const { product_id, variant_id, image_id, is_primary, order_index } = imageData;
      const query = `
        INSERT INTO product_images (product_id, variant_id, image_id, is_primary, order_index)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, variant_id, image_id, is_primary, order_index]);
}

function getProductImages(product_id) {
      return pgPool.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY order_index ASC', [product_id]);
}

function updateInventory(inventoryData) {
      const { product_id, variant_id, quantity, reserved_quantity, location } = inventoryData;
      const query = `
        INSERT INTO product_inventory (product_id, variant_id, quantity, reserved_quantity, location)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (product_id, variant_id, location) 
        DO UPDATE SET 
            quantity = EXCLUDED.quantity,
            reserved_quantity = EXCLUDED.reserved_quantity,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;
      return pgPool.query(query, [product_id, variant_id, quantity, reserved_quantity, location]);
}

function addPriceHistory(priceData) {
      const { product_id, variant_id, price, change_reason, effective_date, discount_percentage, currency, source } = priceData;
      const query = `
        INSERT INTO product_price_history (
            product_id, 
            variant_id, 
            price, 
            change_reason,
            effective_date,
            discount_percentage,
            currency,
            source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, variant_id, price, change_reason, effective_date || new Date(), discount_percentage || 0, currency || 'USD', source || 'system']);
}

function getProductPriceStatistics(product_id, variant_id) {
      const query = `
        WITH price_stats AS (
            SELECT 
                MIN(price) as min_price,
                MAX(price) as max_price,
                AVG(price) as avg_price,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price,
                COUNT(*) as total_changes,
                MAX(price) - MIN(price) as price_range,
                (MAX(price) - MIN(price)) / MIN(price) * 100 as price_change_percentage
            FROM product_price_history
            WHERE product_id = $1
            ${variant_id ? 'AND variant_id = $2' : ''}
        ),
        recent_changes AS (
            SELECT 
                price,
                change_reason,
                effective_date,
                LAG(price) OVER (ORDER BY effective_date) as previous_price,
                price - LAG(price) OVER (ORDER BY effective_date) as price_difference,
                ((price - LAG(price) OVER (ORDER BY effective_date)) / LAG(price) OVER (ORDER BY effective_date) * 100) as percentage_change
            FROM product_price_history
            WHERE product_id = $1
            ${variant_id ? 'AND variant_id = $2' : ''}
            ORDER BY effective_date DESC
            LIMIT 5
        )
        SELECT 
            ps.*,
            json_agg(rc.*) as recent_changes
        FROM price_stats ps
        CROSS JOIN recent_changes rc
        GROUP BY 
            ps.min_price, 
            ps.max_price, 
            ps.avg_price, 
            ps.median_price, 
            ps.total_changes, 
            ps.price_range, 
            ps.price_change_percentage
    `;
      const params = variant_id ? [product_id, variant_id] : [product_id];
      return pgPool.query(query, params);
}

function getProductPriceTrends(product_id, variant_id, period = '30 days') {
      const periodMatch = period.match(/^(\d+)\s+(day|week|month|year)s?$/i);
      if (!periodMatch) {
            throw new Error('Invalid period format. Use format like "30 days", "1 week", "6 months", "1 year"');
      }

      const [_, amount, unit] = periodMatch;
      const interval = `${amount} ${unit}`;

      const variantId = variant_id && variant_id !== 'null' ? parseInt(variant_id, 10) : null;
      if (variant_id && variant_id !== 'null' && isNaN(variantId)) {
            throw new Error('Invalid variant_id format');
      }

      const query = `
        WITH price_trends AS (
            SELECT 
                date_trunc('day', effective_date) as date,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price,
                COUNT(*) as change_count
            FROM product_price_history
            WHERE product_id = $1
            ${variantId ? 'AND variant_id = $2' : ''}
            AND effective_date >= NOW() - ${variantId ? '$3' : '$2'}::interval
            GROUP BY date_trunc('day', effective_date)
            ORDER BY date
        )
        SELECT 
            json_agg(
                json_build_object(
                    'date', date,
                    'avg_price', avg_price,
                    'min_price', min_price,
                    'max_price', max_price,
                    'change_count', change_count
                )
            ) as trends
        FROM price_trends
    `;

      const params = variantId ? [product_id, variantId, interval] : [product_id, interval];

      return pgPool.query(query, params);
}

function createProductAttribute(attributeData) {
      const { name, type } = attributeData;
      const query = `
        INSERT INTO product_attributes (name, data_type)
        VALUES ($1, $2)
        RETURNING *
    `;
      return pgPool.query(query, [name, type]);
}

function addProductAttributeValue(valueData) {
      const { product_id, attribute_id, value } = valueData;
      const query = `
        INSERT INTO product_attribute_values (product_id, attribute_id, value)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, attribute_id, value]);
}

function addProductReview(reviewData) {
      const { product_id, user_id, rating, review_text, is_verified } = reviewData;
      const query = `
        INSERT INTO product_reviews (product_id, user_id, rating, review_text, is_verified)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, user_id, rating, review_text, is_verified]);
}

function getProductReviews(product_id, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      return pgPool.query(
            `SELECT r.*, COUNT(*) OVER() as total_count 
         FROM product_reviews r 
         WHERE r.product_id = $1 AND r.deleted_at IS NULL 
         ORDER BY r.created_at DESC 
         LIMIT $2 OFFSET $3`,
            [product_id, limit, offset]
      );
}

function addToWishlist(userId, productId) {
      const query = `
        INSERT INTO wishlist (user_id, product_id)
        VALUES ($1, $2)
        RETURNING id
    `;
      return pgPool.query(query, [userId, productId]);
}

function getWishlist(user_id, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      const query = `
        SELECT w.*, p.*, COUNT(*) OVER() as total_count
        FROM wishlist w
        JOIN products p ON w.product_id = p.id
        WHERE w.user_id = $1
        ORDER BY w.created_at DESC
        LIMIT $2 OFFSET $3
    `;
      return pgPool.query(query, [user_id, limit, offset]);
}

function createProductVersion(versionData) {
      const { product_id, version_number, changes, created_by } = versionData;
      const query = `
        INSERT INTO product_versions (product_id, version_number, changes, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, version_number, changes, created_by]);
}

function addProductRelationship(relationshipData) {
      const { product_id, related_product_id, relationship_type } = relationshipData;
      const query = `
        INSERT INTO product_relationships (product_id, related_product_id, relationship_type)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, related_product_id, relationship_type]);
}

function paginateResults(req, res, next) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      req.pagination = {
            page,
            limit,
            offset,
      };
      next();
}

function requestLogger(req, res, next) {
      const start = Date.now();
      const requestId = Math.random().toString(36).substring(7);

      logger.debug('Incoming request', {
            requestId,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('user-agent'),
      });

      if (req.method !== 'GET' && req.body) {
            logger.debug('Request body', {
                  requestId,
                  body: req.body,
            });
      }

      const originalSend = res.send;
      res.send = function (body) {
            const responseTime = Date.now() - start;
            const statusCode = res.statusCode;

            logger.info('Request completed', {
                  requestId,
                  method: req.method,
                  url: req.originalUrl,
                  statusCode,
                  responseTime: `${responseTime}ms`,
            });

            if (statusCode >= 400) {
                  logger.error('Error response', {
                        requestId,
                        statusCode,
                        body: typeof body === 'string' ? body : JSON.stringify(body),
                  });
            }

            originalSend.call(this, body);
      };

      next();
}

// =====================[ errorLogger Enhancement ]=====================
function errorLogger(err, req, res, next) {
      const requestId = getRequestId(req);
      logger.error('Unhandled error', {
            requestId,
            error: err.message,
            stack: err.stack,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('user-agent'),
      });
      if (req.method !== 'GET' && req.body) {
            logger.debug('Request body at error', {
                  requestId,
                  body: req.body,
            });
      }
      next(err);
}

function getProductAttributes(product_id) {
      return pgPool.query(
            `SELECT pa.name, pa.type, pav.value 
   FROM product_attributes pa 
   JOIN product_attribute_values pav ON pa.id = pav.attribute_id 
   WHERE pav.product_id = $1`,
            [product_id]
      );
}

function getProductPriceHistory(product_id, variant_id) {
      const query = variant_id
            ? `SELECT * FROM product_price_history 
     WHERE product_id = $1 AND variant_id = $2 
     ORDER BY effective_date DESC`
            : `SELECT * FROM product_price_history 
     WHERE product_id = $1 
     ORDER BY effective_date DESC`;
      const params = variant_id ? [product_id, variant_id] : [product_id];
      return pgPool.query(query, params);
}

function getProductRelationships(product_id, relationship_type) {
      const query = relationship_type
            ? `SELECT p.*, pr.relationship_type 
     FROM products p 
     JOIN product_relationships pr ON p.id = pr.related_product_id 
     WHERE pr.product_id = $1 AND pr.relationship_type = $2`
            : `SELECT p.*, pr.relationship_type 
     FROM products p 
     JOIN product_relationships pr ON p.id = pr.related_product_id 
     WHERE pr.product_id = $1`;
      const params = relationship_type ? [product_id, relationship_type] : [product_id];
      return pgPool.query(query, params);
}

function getProductVersions(product_id) {
      return pgPool.query('SELECT * FROM product_versions WHERE product_id = $1 ORDER BY version_number DESC', [product_id]);
}

function free() {
      console.log('\nCore free...');

      // try {
      //     clearCorruptedCache();
      // } catch (_) {
      // } finally {
      //     console.log('Cache cleared');
      // }

      setTimeout(() => {
            process.exit(0);
      }, 1000);
}

async function createMaterializedViewIndexes() {
      const client = await pgPool.connect();
      try {
            await client.query('BEGIN');

            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_analytics_id ON mv_product_analytics(id)');
            console.log('Created unique index for mv_product_analytics');

            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_analytics_id ON mv_category_analytics(id)');
            console.log('Created unique index for mv_category_analytics');

            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_price_trends_id ON mv_product_price_trends(id)');
            console.log('Created unique index for mv_product_price_trends');

            await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_inventory_status_id ON mv_product_inventory_status(id)');
            console.log('Created unique index for mv_product_inventory_status');

            await client.query('COMMIT');
      } catch (error) {
            await client.query('ROLLBACK');
            throw error;
      } finally {
            client.release();
      }
}

async function searchProductDocuments(searchQuery, { page = 1, limit = 10 } = {}) {
      const offset = (page - 1) * limit;
      const query = `
        SELECT pd.*, p.name as product_name, c.name as category_name,
               COUNT(*) OVER() as total_count
        FROM product_documents pd
        JOIN products p ON pd.product_id = p.id
        LEFT JOIN categories c ON pd.category_id = c.id
        WHERE to_tsvector('english', pd.name || ' ' || COALESCE(pd.description, '')) @@ to_tsquery('english', $1)
        ORDER BY pd.created_at DESC
        LIMIT $2 OFFSET $3
    `;
      return pgPool.query(query, [searchQuery.replace(/\s+/g, ' & '), limit, offset]);
}

async function searchProducts(searchParams) {
      const { page = 1, pageSize = DEFAULT_PAGE_SIZE, sortField = DEFAULT_SORT_FIELD, sortOrder = DEFAULT_SORT_ORDER, name, category_id, min_price, max_price, tags, attributes } = searchParams;

      const validatedPageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
      const offset = (page - 1) * validatedPageSize;

      let query = `
        SELECT p.*, 
               COUNT(*) OVER() as total_count,
               array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL) as tags,
               jsonb_object_agg(
                   pa.name,
                   pav.value
               ) FILTER (WHERE pa.name IS NOT NULL AND pav.value IS NOT NULL) as attributes
        FROM products p
        LEFT JOIN product_tags t ON p.id = t.product_id
        LEFT JOIN product_attribute_values pav ON p.id = pav.product_id
        LEFT JOIN product_attributes pa ON pav.attribute_id = pa.id
        WHERE 1=1
    `;

      const queryParams = [];
      let paramIndex = 1;

      if (name) {
            query += ` AND p.name ILIKE $${paramIndex}`;
            queryParams.push(`%${name}%`);
            paramIndex++;
      }

      if (category_id) {
            query += ` AND p.category_id = $${paramIndex}`;
            queryParams.push(category_id);
            paramIndex++;
      }

      if (min_price !== undefined) {
            query += ` AND p.price >= $${paramIndex}`;
            queryParams.push(min_price);
            paramIndex++;
      }

      if (max_price !== undefined) {
            query += ` AND p.price <= $${paramIndex}`;
            queryParams.push(max_price);
            paramIndex++;
      }

      if (tags && tags.length > 0) {
            query += ` AND EXISTS (
            SELECT 1 FROM product_tags t2 
            WHERE t2.product_id = p.id 
            AND t2.tag_name = ANY($${paramIndex})
        )`;
            queryParams.push(tags);
            paramIndex++;
      }

      if (attributes && Object.keys(attributes).length > 0) {
            const attributeConditions = [];
            for (const [key, value] of Object.entries(attributes)) {
                  attributeConditions.push(`(
                pa.name = $${paramIndex} 
                AND pav.value = $${paramIndex + 1}
            )`);
                  queryParams.push(key, value);
                  paramIndex += 2;
            }
            query += ` AND (${attributeConditions.join(' OR ')})`;
      }

      query += `
        GROUP BY p.id
        ORDER BY p.${sortField} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
      queryParams.push(validatedPageSize, offset);

      const result = await pgPool.query(query, queryParams);

      return {
            items: result.rows,
            pagination: {
                  total: parseInt(result.rows[0]?.total_count || 0),
                  page: page,
                  pageSize: validatedPageSize,
                  totalPages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / validatedPageSize),
            },
      };
}

async function createOptimizedIndexes() {
      const client = await pgPool.connect();
      try {
            logger.info('Starting database index creation');
            await client.query('BEGIN');

            for (const index of schemaConfig.indexes) {
                  try {
                        await client.query(index.query);
                        logger.info(`Created index: ${index.name}`, {
                              indexName: index.name,
                              query: index.query,
                        });
                  } catch (error) {
                        logger.error(`Failed to create index ${index.name}`, {
                              error: error.message,
                              stack: error.stack,
                              indexName: index.name,
                              query: index.query,
                        });
                        throw error;
                  }
            }

            await client.query('COMMIT');
            logger.info('Database index creation completed successfully');
      } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Database index creation failed', {
                  error: error.message,
                  stack: error.stack,
            });
            throw error;
      } finally {
            client.release();
      }
}

async function createMaterializedViews() {
      const client = await pgPool.connect();
      try {
            await client.query('BEGIN');

            for (const view of schemaConfig.materializedViews) {
                  try {
                        await client.query(view.query);
                        console.log(`Created materialized view: ${view.name}`);
                  } catch (error) {
                        console.error(`Failed to create materialized view ${view.name}:`, error);
                        throw error;
                  }
            }

            await client.query('COMMIT');
      } catch (error) {
            await client.query('ROLLBACK');
            throw error;
      } finally {
            client.release();
      }
}
async function updateProductStatus(id, status) {
      const validStatuses = ['active', 'inactive', 'draft', 'archived'];
      if (!validStatuses.includes(status)) {
            throw new Error('Invalid product status');
      }

      const query = `
        UPDATE products 
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING *
    `;
      return pgPool.query(query, [status, id]);
}
async function updateProduct(id, productData) {
      const { name, price, description, category_id, metadata } = productData;
      const query = `
        UPDATE products 
        SET name = $1, 
            price = $2, 
            description = $3, 
            category_id = $4, 
            metadata = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND deleted_at IS NULL
        RETURNING *
    `;
      return pgPool.query(query, [name, price, description, category_id, metadata, id]);
}

async function deleteProduct(id) {
      const query = `
        UPDATE products 
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
    `;
      return pgPool.query(query, [id]);
}
async function bulkUpdateProductStatus(productIds, status) {
      const validStatuses = ['active', 'inactive', 'draft', 'archived'];
      if (!validStatuses.includes(status)) {
            throw new Error('Invalid product status');
      }

      const query = `
        UPDATE products 
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2) AND deleted_at IS NULL
        RETURNING *
    `;
      return pgPool.query(query, [status, productIds]);
}

async function getProductStatistics() {
      const query = `
        SELECT 
            COUNT(*) as total_products,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
            COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_products,
            COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_products,
            COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_products,
            COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_products,
            AVG(price) as average_price,
            MIN(price) as min_price,
            MAX(price) as max_price
        FROM products
    `;
      return pgPool.query(query);
}
async function refreshMaterializedViews() {
      const client = await pgPool.connect();
      try {
            logger.info('Starting materialized views refresh');
            await client.query('BEGIN');

            for (const view of schemaConfig.materializedViews) {
                  try {
                        await client.query(view.refreshQuery);
                        logger.info(`Refreshed materialized view: ${view.name}`, {
                              viewName: view.name,
                              query: view.refreshQuery,
                        });
                  } catch (error) {
                        logger.error(`Failed to refresh materialized view ${view.name}`, {
                              error: error.message,
                              stack: error.stack,
                              viewName: view.name,
                              query: view.refreshQuery,
                        });
                        throw error;
                  }
            }

            await client.query('COMMIT');
            logger.info('Materialized views refresh completed successfully');
      } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Materialized views refresh failed', {
                  error: error.message,
                  stack: error.stack,
            });
            throw error;
      } finally {
            client.release();
      }
}

async function createDatabaseSchema() {
      try {
            logger.info('Starting database schema creation');

            await createSchemaVersionTable();
            logger.debug('Schema version table created successfully');

            const currentVersion = await getCurrentSchemaVersion();
            logger.debug('Current schema version', { version: currentVersion });

            for (const migration of schemaConfig.migrations) {
                  if (migration.version > currentVersion) {
                        logger.info(`Applying migration: ${migration.name}`, {
                              version: migration.version,
                              name: migration.name,
                              queryCount: migration.queries.length,
                        });
                        await applySchemaMigration(migration.version, migration.name, migration.queries);
                  }
            }

            // Add missing columns for Sequelize compatibility
            await addMissingColumnsForSequelize();

            // Create missing tables for Sequelize models
            await createMissingTablesForSequelize();

            logger.info('Database schema creation completed successfully');
      } catch (error) {
            logger.error('Database schema creation failed', {
                  error: error.message,
                  stack: error.stack,
            });
            throw error;
      }
}

async function addMissingColumnsForSequelize() {
      const client = await pgPool.connect();
      try {
            logger.info('Adding missing columns for Sequelize compatibility');
            await client.query('BEGIN');

            // Add missing columns to categories table
            const categoryColumns = [
                  "attribute_metadata JSONB DEFAULT '{}'",
                  'slug VARCHAR(255)',
                  'description TEXT',
                  'level INTEGER DEFAULT 1',
                  "path INTEGER[] DEFAULT '{}'",
                  '"order" INTEGER DEFAULT 0',
                  "status VARCHAR(20) DEFAULT 'active'",
                  'is_featured BOOLEAN DEFAULT false',
                  'image_ids TEXT[] DEFAULT ARRAY[]::TEXT[]',
                  'meta_title VARCHAR(255)',
                  'meta_description TEXT',
                  "meta_keywords VARCHAR(255)[] DEFAULT '{}'",
                  "settings JSONB DEFAULT '{}'",
                  'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                  'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                  'deleted_at TIMESTAMP',
            ];

            for (const column of categoryColumns) {
                  try {
                        await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS ${column}`);
                  } catch (error) {
                        logger.warn(`Could not add column ${column} to categories table`, { error: error.message });
                  }
            }

            // Add missing columns to products table
            const productColumns = ["status VARCHAR(20) DEFAULT 'active'", "metadata JSONB DEFAULT '{}'", 'image_ids TEXT[] DEFAULT ARRAY[]::TEXT[]', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'deleted_at TIMESTAMP'];

            for (const column of productColumns) {
                  try {
                        await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${column}`);
                  } catch (error) {
                        logger.warn(`Could not add column ${column} to products table`, { error: error.message });
                  }
            }

            // Make category_id optional in products table
            try {
                  await client.query('ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL');
            } catch (error) {
                  logger.warn('Could not make category_id optional in products table', { error: error.message });
            }

            await client.query('COMMIT');
            logger.info('Missing columns added successfully');
      } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to add missing columns', {
                  error: error.message,
                  stack: error.stack,
            });
            throw error;
      } finally {
            client.release();
      }
}

async function createSchemaVersionTable() {
      const query = `
        CREATE TABLE IF NOT EXISTS schema_versions (
            id SERIAL PRIMARY KEY,
            version INTEGER NOT NULL,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(version)
        );
    `;
      await pgPool.query(query);
}

async function getCurrentSchemaVersion() {
      const query = 'SELECT MAX(version) as current_version FROM schema_versions';
      const result = await pgPool.query(query);
      return result.rows[0]?.current_version || 0;
}

async function applySchemaMigration(version, name, queries) {
      const client = await pgPool.connect();
      try {
            logger.info(`Starting migration ${version}: ${name}`, {
                  version,
                  name,
                  queryCount: queries.length,
            });
            await client.query('BEGIN');

            const checkQuery = 'SELECT version FROM schema_versions WHERE version = $1';
            const checkResult = await client.query(checkQuery, [version]);

            if (checkResult.rows.length === 0) {
                  for (const query of queries) {
                        logger.debug(`Executing migration query`, {
                              version,
                              name,
                              query: query.substring(0, 100) + '...',
                        });
                        await client.query(query);
                  }

                  const insertQuery = 'INSERT INTO schema_versions (version, name) VALUES ($1, $2)';
                  await client.query(insertQuery, [version, name]);
                  logger.info(`Successfully applied migration ${version}: ${name}`, {
                        version,
                        name,
                        queryCount: queries.length,
                  });
            } else {
                  logger.debug(`Migration ${version}: ${name} already applied, skipping`, {
                        version,
                        name,
                  });
            }

            await client.query('COMMIT');
      } catch (error) {
            logger.error(`Failed to apply migration ${version}: ${name}`, {
                  error: error.message,
                  stack: error.stack,
                  version,
                  name,
                  queries,
            });
            await client.query('ROLLBACK');
            throw error;
      } finally {
            client.release();
      }
}

// ======================================================================
// Middleware

function validateProductIdMiddleware(req, res, next) {
      const productId = req.params.id || req.params.productId;
      if (!productId || isNaN(parseInt(productId))) {
            return res.status(400).json({
                  error: 'Invalid product ID. Must be a valid integer.',
                  requestId: getRequestId(req),
            });
      }
      next();
}

function validateVariantIdMiddleware(req, res, next) {
      const variantId = req.query.variant_id;
      if (variantId && isNaN(parseInt(variantId))) {
            return res.status(400).json({
                  error: 'Invalid variant ID. Must be a valid integer.',
                  requestId: getRequestId(req),
            });
      }
      next();
}

function validateRequiredFieldsMiddleware(requiredFields) {
      return (req, res, next) => {
            const missingFields = requiredFields.filter(field => !req.body[field]);
            if (missingFields.length > 0) {
                  return res.status(400).json({
                        error: `Missing required fields: ${missingFields.join(', ')}`,
                        requestId: getRequestId(req),
                  });
            }
            next();
      };
}

// ======================================================================
// Controller

async function healthCheckController(req, res) {
      try {
            const health = {
                  uptime: process.uptime(),
                  message: 'OK',
                  timestamp: Date.now(),
                  postgres: pgPool ? 'connected' : 'disconnected',
            };
            res.json({ ...health, requestId: getRequestId(req) });
      } catch (error) {
            logger.error('Health check failed', { error: error.message });
            res.status(500).json({ error: 'Health check failed' });
      }
}

async function createProductController(req, res) {
      try {
            const { attributes, ...productData } = req.body;
            if (attributes && Array.isArray(attributes)) {
                  const product = await createProductWithAttributes(productData, attributes);
                  res.success(product, 'Product created successfully');
            } else {
                  const result = await createProduct(productData);
                  res.success(result.rows[0], 'Product created successfully');
            }
      } catch (error) {
            res.error(error);
      }
}

async function getProductByIdController(req, res) {
      try {
            const product = await getProductById(req.params.id);
            if (!product) {
                  return res.error('Product not found', 404);
            }
            res.success(product);
      } catch (error) {
            res.error(error);
      }
}

async function searchProductsController(req, res) {
      try {
            const searchParams = {
                  page: req.pagination.page,
                  pageSize: req.pagination.limit,
                  ...req.query,
            };
            const result = await searchProducts(searchParams);
            res.success({
                  items: result.items,
                  pagination: result.pagination,
            });
      } catch (error) {
            res.error(error);
      }
}

async function addCommentController(req, res) {
      try {
            const commentData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await addComment(commentData);
            res.success(result.rows[0], 'Comment added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductCommentsController(req, res) {
      try {
            const result = await getProductComments(req.params.productId, req.pagination);
            res.success({
                  data: result.rows,
                  pagination: {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: parseInt(result.rows[0]?.total_count || 0),
                        pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / req.pagination.limit),
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function addTagToProductController(req, res) {
      try {
            const { tag_name } = req.body;
            const result = await addTagToProduct(req.params.productId, tag_name);
            res.success(result.rows[0], 'Tag added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductsByTagController(req, res) {
      try {
            const result = await getProductsByTag(req.params.tagName, req.pagination);
            res.success({
                  data: result.rows,
                  pagination: {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: parseInt(result.rows[0]?.total_count || 0),
                        pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / req.pagination.limit),
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function searchProductDocumentsController(req, res) {
      try {
            const result = await searchProductDocuments(req.query.q, req.pagination);
            res.success({
                  data: result.rows,
                  pagination: {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: parseInt(result.rows[0]?.total_count || 0),
                        pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / req.pagination.limit),
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function getPriceTrendsController(req, res) {
      try {
            const productId = parseInt(req.params.id);
            const variantId = req.query.variant_id ? parseInt(req.query.variant_id) : null;
            const period = req.query.period || '30 days';

            const trends = await getProductPriceTrends(productId, variantId, period);
            res.success(trends);
      } catch (error) {
            res.error(error);
      }
}

async function addPriceHistoryController(req, res) {
      try {
            const priceData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await addPriceHistory(priceData);
            res.success(result.rows[0], 'Price history added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function addProductRelationshipController(req, res) {
      try {
            const relationshipData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await addProductRelationship(relationshipData);
            res.success(result.rows[0], 'Product relationship added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductRelationshipsController(req, res) {
      try {
            const result = await getProductRelationships(req.params.productId, req.query.relationship_type);
            res.success(result.rows);
      } catch (error) {
            res.error(error);
      }
}

async function createProductVersionController(req, res) {
      try {
            const versionData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await createProductVersion(versionData);
            res.success(result.rows[0], 'Product version created successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductVersionsController(req, res) {
      try {
            const result = await getProductVersions(req.params.productId);
            res.success(result.rows);
      } catch (error) {
            res.error(error);
      }
}

async function createProductVariantController(req, res) {
      try {
            const variantData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await createProductVariant(variantData);
            res.success(result.rows[0], 'Product variant created successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductVariantsController(req, res) {
      try {
            const result = await getProductVariants(req.params.productId);
            res.success(result.rows);
      } catch (error) {
            res.error(error);
      }
}

async function addProductImageController(req, res) {
      try {
            const imageData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await addProductImage(imageData);
            res.success(result.rows[0], 'Product image added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductImagesController(req, res) {
      try {
            const result = await getProductImages(req.params.productId);
            res.success(result.rows);
      } catch (error) {
            res.error(error);
      }
}

async function updateInventoryController(req, res) {
      try {
            const inventoryData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await updateInventory(inventoryData);
            res.success(result.rows[0], 'Inventory updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function addProductReviewController(req, res) {
      try {
            const reviewData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await addProductReview(reviewData);
            res.success(result.rows[0], 'Product review added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductReviewsController(req, res) {
      try {
            const result = await getProductReviews(req.params.productId, req.pagination);
            res.success({
                  data: result.rows,
                  pagination: {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: parseInt(result.rows[0]?.total_count || 0),
                        pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / req.pagination.limit),
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function addToWishlistController(req, res) {
      try {
            const { userId } = req.params;
            const { product_id } = req.body;

            if (!userId || !product_id) {
                  return res.status(400).json({ error: 'Missing required fields' });
            }

            const result = await addToWishlist(userId, product_id);
            res.json({ id: result.rows[0].id });
      } catch (error) {
            console.error('Error adding to wishlist:', error);
            res.status(500).json({ error: 'Failed to add to wishlist' });
      }
}

async function getWishlistController(req, res) {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getWishlist(req.params.userId, req.pagination);
            res.success({
                  data: result.rows,
                  pagination: {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: parseInt(result.rows[0]?.total_count || 0),
                        pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / req.pagination.limit),
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function addProductAttributeController(req, res) {
      try {
            const attributeData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await addProductAttributeValue(attributeData);
            res.success(result.rows[0], 'Product attribute added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function createAttributeController(req, res) {
      try {
            const result = await createProductAttribute(req.body);
            res.success(result.rows[0], 'Attribute created successfully');
      } catch (error) {
            res.error(error);
      }
}

async function createProductChatController(req, res) {
      try {
            const chatData = {
                  ...req.body,
                  product_id: req.params.productId,
            };
            const result = await createProductChat(chatData);
            res.success(result.rows[0], 'Product chat created successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getUserChatsController(req, res) {
      try {
            const result = await getProductChats(req.params.userId, req.pagination);
            res.success({
                  data: result.rows,
                  pagination: {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: parseInt(result.rows[0]?.total_count || 0),
                        pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / req.pagination.limit),
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function addChatMessageController(req, res) {
      try {
            const messageData = {
                  ...req.body,
                  chat_id: req.params.chatId,
            };
            const result = await addChatMessage(messageData);
            res.success(result, 'Chat message added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getChatMessagesController(req, res) {
      try {
            const result = await getChatMessages(req.params.chatId, req.pagination);
            res.success({
                  data: result.items || result.rows || [],
                  pagination: result.pagination || {
                        page: req.pagination.page,
                        limit: req.pagination.limit,
                        total: result.total || 0,
                        pages: result.pages || 0,
                  },
            });
      } catch (error) {
            res.error(error);
      }
}

async function markChatMessagesAsReadController(req, res) {
      try {
            const result = await markChatMessagesAsRead(req.params.chatId, req.body.user_id);
            res.success(result, 'Chat messages marked as read successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductAnalyticsController(req, res) {
      try {
            const result = await getProductAnalytics(req.params.productId);
            if (!result) {
                  return res.error('Product not found', 404);
            }
            res.success(result);
      } catch (error) {
            res.error(error);
      }
}

async function getProductAttributesController(req, res) {
      try {
            const result = await getProductAttributes(req.params.productId);
            res.success(result);
      } catch (error) {
            res.error(error);
      }
}

async function getProductPriceHistoryController(req, res) {
      try {
            const history = await getProductPriceHistory(req.params.productId);
            res.success(history);
      } catch (error) {
            res.error(error);
      }
}

async function getProductPriceStatisticsController(req, res) {
      try {
            const result = await getProductPriceStatistics(req.params.productId, req.query.variant_id);
            res.success(result);
      } catch (error) {
            res.error(error);
      }
}

async function updateProductController(req, res) {
      try {
            const result = await updateProduct(req.params.id, req.body);
            if (!result) {
                  return res.error('Product not found or already deleted', 404);
            }
            res.success(result, 'Product updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function deleteProductController(req, res) {
      try {
            const result = await deleteProduct(req.params.id);
            if (!result) {
                  return res.error('Product not found or already deleted', 404);
            }
            res.success(result, 'Product deleted successfully');
      } catch (error) {
            res.error(error);
      }
}

async function updateProductStatusController(req, res) {
      try {
            const result = await updateProductStatus(req.params.id, req.body.status);
            if (!result) {
                  return res.error('Product not found or already deleted', 404);
            }
            res.success(result, 'Product status updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function bulkUpdateProductStatusController(req, res) {
      try {
            const { productIds, status } = req.body;
            if (!Array.isArray(productIds) || productIds.length === 0) {
                  return res.error('Invalid product IDs array', 400);
            }
            const result = await bulkUpdateProductStatus(productIds, status);
            res.success(result, 'Product statuses updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductStatisticsController(req, res) {
      try {
            const result = await getProductStatistics();
            res.success(result, 'Product statistics retrieved successfully');
      } catch (error) {
            res.error(error);
      }
}

// ======================================================================

function scheduleMaterializedViewRefresh() {
      setInterval(refreshMaterializedViews, 60 * 60 * 1000);
}

// ======================================================================
async function main() {
      init();
}
main();
// ======================================================================

async function createProductWithAttributes(productData, attributeValues) {
      // productData: {name, price, description, category_id, ...}
      // attributeValues: [{category_attribute_id, value}]
      // دریافت attributeهای اجباری دسته و والدها
      let attributes = [];
      let currentCategoryId = productData.category_id;
      while (currentCategoryId) {
            const attrs = await CategoryAttribute.findAll({
                  where: { category_id: currentCategoryId, required: true },
                  include: [{ model: CategoryAttributeOption, as: 'options' }],
            });
            attributes = [...attrs, ...attributes];
            const cat = await Category.findByPk(currentCategoryId);
            currentCategoryId = cat && cat.parent_id ? cat.parent_id : null;
      }
      // اعتبارسنجی attributeهای اجباری
      for (const attr of attributes) {
            const val = attributeValues.find(v => v.category_attribute_id == attr.id);
            if (!val || val.value === undefined || val.value === null || val.value === '') {
                  throw new Error(`Attribute '${attr.name}' is required`);
            }
            if (attr.type === 'number' && isNaN(Number(val.value))) {
                  throw new Error(`Attribute '${attr.name}' must be a number`);
            }
            if (attr.type === 'enum') {
                  const allowed = attr.options.map(o => o.value);
                  if (!allowed.includes(val.value)) {
                        throw new Error(`Attribute '${attr.name}' must be one of: ${allowed.join(', ')}`);
                  }
            }
      }
      // ساخت محصول
      const result = await createProduct(productData);
      const product = result;
      // ذخیره attributeها
      for (const attrVal of attributeValues) {
            await ProductAttributeValue.create({
                  product_id: product.id,
                  category_attribute_id: attrVal.category_attribute_id,
                  value: attrVal.value,
            });
      }
      return product;
}

async function createMissingTablesForSequelize() {
      const client = await pgPool.connect();
      try {
            logger.info('Creating missing tables for Sequelize models');
            await client.query('BEGIN');

            // Create languages table
            await client.query(`
                  CREATE TABLE IF NOT EXISTS languages (
                      id SERIAL PRIMARY KEY,
                      code VARCHAR(10) UNIQUE NOT NULL,
                      name VARCHAR(100) NOT NULL,
                      native_name VARCHAR(100) NOT NULL,
                      is_default BOOLEAN DEFAULT false,
                      is_active BOOLEAN DEFAULT true,
                      direction VARCHAR(3) DEFAULT 'ltr',
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                  )
            `);

            // Create category_attributes table
            await client.query(`
                  CREATE TABLE IF NOT EXISTS category_attributes (
                      id SERIAL PRIMARY KEY,
                      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                      name VARCHAR(255) NOT NULL,
                      type VARCHAR(20) NOT NULL,
                      required BOOLEAN DEFAULT false,
                      "order" INTEGER DEFAULT 0,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                  )
            `);

            // Create category_attribute_options table
            await client.query(`
                  CREATE TABLE IF NOT EXISTS category_attribute_options (
                      id SERIAL PRIMARY KEY,
                      category_attribute_id INTEGER REFERENCES category_attributes(id) ON DELETE CASCADE,
                      value VARCHAR(255) NOT NULL,
                      "order" INTEGER DEFAULT 0,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                  )
            `);

            // Create product_attribute_values table (if it doesn't exist)
            await client.query(`
                  CREATE TABLE IF NOT EXISTS product_attribute_values (
                      id SERIAL PRIMARY KEY,
                      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                      category_attribute_id INTEGER REFERENCES category_attributes(id) ON DELETE CASCADE,
                      value TEXT NOT NULL,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      UNIQUE(product_id, category_attribute_id)
                  )
            `);

            // Create product_images table
            await client.query(`
                  CREATE TABLE IF NOT EXISTS product_images (
                      id SERIAL PRIMARY KEY,
                      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                      variant_id INTEGER,
                      image_id TEXT NOT NULL, -- شناسه یونیک عکس
                      is_primary BOOLEAN DEFAULT false,
                      order_index INTEGER DEFAULT 0,
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                  )
            `);

            await client.query('COMMIT');
            logger.info('Missing tables created successfully');
      } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to create missing tables', {
                  error: error.message,
                  stack: error.stack,
            });
            throw error;
      } finally {
            client.release();
      }
}

// =====================[ Request ID Utility ]=====================
function getRequestId(req) {
      if (req.requestId) return req.requestId;
      const id = uuidv4();
      req.requestId = id;
      return id;
}

// =====================[ PGUI Worker ]=====================
let pguiProcess = null;
function startPguiWorker() {
      if (pguiProcess) return;
      logger.info('Starting PGUI admin panel worker...');
      pguiProcess = spawn('node', ['build/pgui/index.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
            cwd: process.cwd(),
      });
      const grayBg = '\x1b[100m'; // ANSI gray background
      const reset = '\x1b[0m';
      pguiProcess.stdout.on('data', data => {
            logger.info(`${grayBg}[PGUI] ${data.toString().trim()}${reset}`);
      });
      pguiProcess.stderr.on('data', data => {
            logger.error(`${grayBg}[PGUI] ${data.toString().trim()}${reset}`);
      });
      pguiProcess.on('close', code => {
            logger.info(`PGUI admin panel exited with code ${code}`);
            pguiProcess = null;
      });
}
function stopPguiWorker() {
      if (pguiProcess) {
            logger.info('Stopping PGUI admin panel worker...');
            pguiProcess.kill('SIGTERM');
            pguiProcess = null;
      }
}

process.on('beforeExit', () => {
      stopPguiWorker();
      free;
});
process.on('SIGINT', () => {
      stopPguiWorker();
      free();
});
process.on('SIGTERM', () => {
      stopPguiWorker();
      free();
});
process.on('SIGQUIT', () => {
      stopPguiWorker();
      free();
});
