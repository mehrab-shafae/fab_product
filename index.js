import 'dotenv/config';
// ======================================================================
import express from 'express';
// import { execSync } from 'child_process';
import { Pool } from 'pg';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger, format, transports } from 'winston';
import helmet from 'helmet';
import YAML from 'yamljs';
import { sequelize } from './src/models/index.js';
import categoryRoutes from './src/routes/categoryRoutes.js';

// ======================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaConfig = JSON.parse(readFileSync(join(__dirname, 'database-schema.json'), 'utf8'));

const PORT = process.env.PORT || 5003;
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

const responseHandler = (req, res, next) => {
      res.success = (data, message = 'Success') => {
            res.json({
                  status: 'success',
                  data,
                  message,
            });
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

            res.status(handledError.statusCode).json({
                  status: 'error',
                  message: handledError.message,
                  data: null,
                  ...(handledError.details && { details: handledError.details }),
            });
      };

      next();
};

const logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(
            timestamp(),
            printf(({ level, message, timestamp, ...metadata }) => {
                  let msg = `${timestamp} [${level}] : ${message}`;
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
                        printf(({ level, message, timestamp, ...metadata }) => {
                              let msg = `${timestamp} [${level}] : ${message}`;
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
                        printf(({ level, message, timestamp, ...metadata }) => {
                              let msg = `${timestamp} [${level}] : ${message}`;
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
                        printf(({ level, message, timestamp, ...metadata }) => {
                              let msg = `${timestamp} [${level}] : ${message}`;
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

const swaggerDocument = YAML.parse(readFileSync(join(__dirname, 'swagger.yaml'), 'utf8'));

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

process.on('beforeExit', free);
process.on('SIGINT', free);
process.on('SIGTERM', free);
process.on('SIGQUIT', free);

// ======================================================================

async function init() {
      const app = express();
      const apiV1Router = express.Router();

      app.use(helmet());
      app.use(
            cors({
                  origin: ['http://localhost:3000'],
                  credentials: true,
            })
      );
      app.use(express.json({ limit: '1mb' }));
      app.use(express.urlencoded({ limit: '1mb', extended: true }));
      // app.use(limiter);
      // app.use(speedLimiter);
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

      app.get('/api-docs/fa', (req, res) => {
            const docsPath = join(__dirname, 'docs-fa.html');
            if (existsSync(docsPath)) {
                  res.sendFile(docsPath);
            } else {
                  console.error(`Documentation file not found at: ${docsPath}`);
                  res.status(404).send('Documentation file not found');
            }
      });

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
            
            // Sync models with database without altering the schema
            await sequelize.sync({ alter: false });
            console.log('Database synchronized successfully.');

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
      });
}

function apiV1Routers(app) {
      app.post('/products', validateRequiredFieldsMiddleware(['name', 'price', 'description']), requestLogger, createProductController);
      //app.post('/categories', validateRequiredFieldsMiddleware(['name']), validateCategoryMiddleware, requestLogger, createCategoryController);
      app.post('/products/:productId/comments', validateRequiredFieldsMiddleware(['content', 'user_id']), validateProductIdMiddleware, requestLogger, addCommentController);
      app.post('/products/:productId/tags', validateRequiredFieldsMiddleware(['tag_name']), validateProductIdMiddleware, requestLogger, addTagToProductController);
      app.post('/products/:productId/chats', validateProductIdMiddleware, requestLogger, createProductChatController);
      app.post('/chats/:chatId/messages', validateRequiredFieldsMiddleware(['content', 'user_id']), requestLogger, addChatMessageController);
      app.post('/chats/:chatId/read', validateRequiredFieldsMiddleware(['user_id']), requestLogger, markChatMessagesAsReadController);
      app.post('/products/:productId/images', validateRequiredFieldsMiddleware(['url', 'alt_text']), validateProductIdMiddleware, requestLogger, addProductImageController);
      app.post('/products/:productId/variants', validateRequiredFieldsMiddleware(['name', 'price', 'sku']), validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, createProductVariantController);
      app.post('/products/:productId/inventory', validateRequiredFieldsMiddleware(['quantity', 'variant_id']), validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, updateInventoryController);
      app.post('/products/:productId/reviews', validateRequiredFieldsMiddleware(['rating', 'content', 'user_id']), validateProductIdMiddleware, requestLogger, addProductReviewController);
      app.post('/users/:userId/wishlist', validateRequiredFieldsMiddleware(['product_id']), requestLogger, addToWishlistController);
      app.post('/products/:productId/attributes', validateRequiredFieldsMiddleware(['attribute_id', 'value']), validateProductIdMiddleware, requestLogger, addProductAttributeController);
      app.post('/attributes', validateRequiredFieldsMiddleware(['name', 'type']), requestLogger, createAttributeController);
      app.post('/products/:productId/price-history', validateRequiredFieldsMiddleware(['price', 'variant_id']), validateProductIdMiddleware, validateVariantIdMiddleware, requestLogger, addPriceHistoryController);
      app.post('/products/:productId/relationships', validateRequiredFieldsMiddleware(['related_product_id', 'relationship_type']), validateProductIdMiddleware, requestLogger, addProductRelationshipController);
      app.post('/products/:productId/versions', validateRequiredFieldsMiddleware(['version_number', 'changes']), validateProductIdMiddleware, requestLogger, createProductVersionController);
      //app.post('/categories/bulk-update', validateCategoryMiddleware, requestLogger, bulkUpdateCategoriesController);

      app.get('/products', paginateResults, requestLogger, searchProductsController);
      app.get('/products/:id', validateProductIdMiddleware, requestLogger, getProductByIdController);
      //app.get('/categories', paginateResults, requestLogger, getCategoriesController);
      //app.get('/categories/tree', requestLogger, getCategoryTreeController);
      app.get('/products/:productId/comments', validateProductIdMiddleware, paginateResults, requestLogger, getProductCommentsController);
      app.get('/products/tags/:tagName', paginateResults, requestLogger, getProductsByTagController);
      app.get('/products/search/document', validateRequiredFieldsMiddleware(['q']), paginateResults, requestLogger, searchProductDocumentsController);
      app.get('/users/:userId/chats', paginateResults, requestLogger, getUserChatsController);
      app.get('/chats/:chatId/messages', paginateResults, requestLogger, getChatMessagesController);
      app.get('/products/statistics', requestLogger, getProductStatisticsController);
      app.get('/products/:productId/analytics', validateProductIdMiddleware, requestLogger, getProductAnalyticsController);
      //app.get('/categories/:categoryId/analytics', validateCategoryMiddleware, requestLogger, getCategoryAnalyticsController);
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
      //app.get('/categories/:id', validateCategoryMiddleware, requestLogger, getCategoryByIdController);
      //app.get('/categories/search', paginateResults, requestLogger, searchCategoriesController);
      //app.get('/categories/slug/:slug', requestLogger, getCategoryBySlugController);

      app.put('/products/:id', validateRequiredFieldsMiddleware(['name', 'price', 'description']), validateProductIdMiddleware, requestLogger, updateProductController);
      //app.put('/categories/:id', validateCategoryMiddleware, requestLogger, updateCategoryController);

      app.delete('/products/:id', validateProductIdMiddleware, requestLogger, deleteProductController);
      //app.delete('/categories/:id', validateCategoryMiddleware, requestLogger, deleteCategoryController);

      app.patch('/products/:id/status', validateRequiredFieldsMiddleware(['status']), validateProductIdMiddleware, requestLogger, updateProductStatusController);
      app.patch('/products/bulk-status', validateRequiredFieldsMiddleware(['productIds', 'status']), requestLogger, bulkUpdateProductStatusController);

      // Add category routes
      app.use('/categories', categoryRoutes);
}

// function executeLinuxCommand(command) {
//     try {
//         return execSync(command, { encoding: 'utf-8' });
//     } catch (error) {
//         console.error('Linux command execution failed:', error);
//         throw error;
//     }
// }

// function optimizeSystemForService() {
//     executeLinuxCommand('ulimit -n 65535');

//     executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = 500;"');
//     executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = 2GB;"');
//     executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET effective_cache_size = 6GB;"');
//     executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET maintenance_work_mem = 512MB;"');
//     executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = 16MB;"');

//     executeLinuxCommand('sync; echo 3 > /proc/sys/vm/drop_caches');

//     executeLinuxCommand('redis-cli config set maxmemory 2gb');
//     executeLinuxCommand('redis-cli config set maxmemory-policy allkeys-lru');

//     executeLinuxCommand('echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq / scaling_governor');
// }

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

function generateSlug(name) {
      return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
}

function createCategory(categoryData) {
      const { name, parent_id } = categoryData;
      const slug = generateSlug(name);

      const query = `
        INSERT INTO categories (name, slug, parent_id)
        SELECT 
            $1::VARCHAR(255),
            $2::VARCHAR(255),
            $3::INTEGER
        WHERE NOT EXISTS (
            SELECT 1 FROM categories 
            WHERE (name = $1::VARCHAR(255) OR slug = $2::VARCHAR(255))
            AND deleted_at IS NULL
        )
        RETURNING *
    `;
      return pgPool.query(query, [name, slug, parent_id]);
}

function getCategoryTree() {
      const query = `
        WITH RECURSIVE category_tree AS (
            SELECT id, name, parent_id, 1 as level
            FROM categories
            WHERE parent_id IS NULL
            UNION ALL
            SELECT c.id, c.name, c.parent_id, ct.level + 1
            FROM categories c
            JOIN category_tree ct ON c.parent_id = ct.id
        )
        SELECT * FROM category_tree
        ORDER BY level, id
    `;
      return pgPool.query(query);
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

function handleDatabaseError(error) {
      if (!error.code || !DB_ERROR_CODES[error.code]) {
            return {
                  message: error.message,
                  statusCode: 500,
            };
      }

      const errorConfig = DB_ERROR_CODES[error.code];
      let message = errorConfig.default;
      let statusCode = 400;

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
                  statusCode = 400;
                  break;
            case '23514':
                  statusCode = 400;
                  break;
            default:
                  statusCode = 500;
      }

      return {
            message,
            statusCode,
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

function getCategoryAnalytics(categoryId) {
      const query = `
        WITH RECURSIVE category_tree AS (
            SELECT id, name, parent_id, 1 as level
            FROM categories
            WHERE id = $1
            UNION ALL
            SELECT c.id, c.name, c.parent_id, ct.level + 1
            FROM categories c
            JOIN category_tree ct ON c.parent_id = ct.id
        ),
        category_stats AS (
            SELECT 
                ct.id,
                ct.name,
                ct.level,
                COUNT(DISTINCT p.id) as product_count,
                COUNT(DISTINCT pc.user_id) as total_viewers,
                COUNT(DISTINCT pt.tag_name) as total_tags,
                AVG(p.price) as avg_price,
                MIN(p.price) as min_price,
                MAX(p.price) as max_price
            FROM category_tree ct
            LEFT JOIN products p ON p.category_id = ct.id
            LEFT JOIN product_comments pc ON p.id = pc.product_id
            LEFT JOIN product_tags pt ON p.id = pt.product_id
            GROUP BY ct.id, ct.name, ct.level
        )
        SELECT 
            cs.*,
            (
                SELECT json_agg(subcat_data)
                FROM (
                    SELECT 
                        subcat.id,
                        subcat.name,
                        COUNT(DISTINCT p.id) as product_count
                    FROM categories subcat
                    LEFT JOIN products p ON p.category_id = subcat.id
                    WHERE subcat.parent_id = cs.id
                    GROUP BY subcat.id, subcat.name
                ) subcat_data
            ) as subcategories
        FROM category_stats cs
        ORDER BY cs.level, cs.product_count DESC
    `;
      return pgPool.query(query, [categoryId]);
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
      const { product_id, variant_id, image_url, is_primary, order_index } = imageData;
      const query = `
        INSERT INTO product_images (product_id, variant_id, image_url, is_primary, order_index)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, variant_id, image_url, is_primary, order_index]);
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

function shareProduct(shareData) {
      const { product_id, user_id, share_type, share_data } = shareData;
      const query = `
        INSERT INTO product_shares (product_id, user_id, share_type, share_data)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
      return pgPool.query(query, [product_id, user_id, share_type, share_data]);
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

function updateCategory(categoryId, categoryData) {
      const { name, parent_id } = categoryData;
      const slug = name ? generateSlug(name) : undefined;

      const query = `
        UPDATE categories 
        SET name = COALESCE($1, name),
            slug = COALESCE($2, slug),
            parent_id = COALESCE($3, parent_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM categories c2 
            WHERE (c2.name = $1 OR c2.slug = $2)
            AND c2.id != $4 
            AND c2.deleted_at IS NULL
        )
        RETURNING *
    `;
      return pgPool.query(query, [name, slug, parent_id, categoryId]);
}

function deleteCategory(categoryId) {
      const query = `
        UPDATE categories 
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
    `;
      return pgPool.query(query, [categoryId]);
}

function getCategoryById(categoryId) {
      const query = `
        SELECT c.*, 
               p.name as parent_name,
               (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count,
               (SELECT COUNT(*) FROM categories subcat WHERE subcat.parent_id = c.id AND subcat.deleted_at IS NULL) as subcategory_count
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.id = $1 AND c.deleted_at IS NULL
    `;
      return pgPool.query(query, [categoryId]);
}

function getCategoryBySlug(slug) {
      const query = `
        SELECT c.*, 
               p.name as parent_name,
               (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count,
               (SELECT COUNT(*) FROM categories subcat WHERE subcat.parent_id = c.id AND subcat.deleted_at IS NULL) as subcategory_count
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.slug = $1 AND c.deleted_at IS NULL
    `;
      return pgPool.query(query, [slug]);
}

function errorLogger(err, req, res, next) {
      const requestId = req.requestId || Math.random().toString(36).substring(7);

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

            logger.info('Database schema creation completed successfully');
      } catch (error) {
            logger.error('Database schema creation failed', {
                  error: error.message,
                  stack: error.stack,
            });
            throw error;
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

async function searchCategories(searchParams, { page = 1, limit = 10 } = {}) {
      const { name, slug, parent_id, include_deleted = false } = searchParams;
      const offset = (page - 1) * limit;

      let conditions = [];
      let params = [];
      let paramIndex = 1;

      if (name) {
            conditions.push(`c.name ILIKE $${paramIndex}`);
            params.push(`%${name}%`);
            paramIndex++;
      }

      if (slug) {
            conditions.push(`c.slug ILIKE $${paramIndex}`);
            params.push(`%${slug}%`);
            paramIndex++;
      }

      if (parent_id) {
            conditions.push(`c.parent_id = $${paramIndex}`);
            params.push(parent_id);
            paramIndex++;
      }

      if (!include_deleted) {
            conditions.push('c.deleted_at IS NULL');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT c.*, 
               p.name as parent_name,
               (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count,
               (SELECT COUNT(*) FROM categories subcat WHERE subcat.parent_id = c.id AND subcat.deleted_at IS NULL) as subcategory_count,
               COUNT(*) OVER() as total_count
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        ${whereClause}
        ORDER BY c.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

      params.push(limit, offset);

      const result = await pgPool.query(query, params);

      return {
            items: result.rows,
            pagination: {
                  page,
                  limit,
                  total: parseInt(result.rows[0]?.total_count || 0),
                  pages: Math.ceil(parseInt(result.rows[0]?.total_count || 0) / limit),
            },
      };
}

async function bulkUpdateCategories(categories) {
      const client = await pgPool.connect();
      try {
            await client.query('BEGIN');
            const results = [];

            for (const category of categories) {
                  const { id, name, parent_id } = category;
                  const result = await client.query(
                        `UPDATE categories 
                 SET name = COALESCE($1, name),
                     parent_id = COALESCE($2, parent_id),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 AND deleted_at IS NULL
                 RETURNING *`,
                        [name, parent_id, id]
                  );
                  results.push(result.rows[0]);
            }

            await client.query('COMMIT');
            return results;
      } catch (error) {
            await client.query('ROLLBACK');
            throw error;
      } finally {
            client.release();
      }
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
            });
      }
      next();
}

function validateVariantIdMiddleware(req, res, next) {
      const variantId = req.query.variant_id;
      if (variantId && isNaN(parseInt(variantId))) {
            return res.status(400).json({
                  error: 'Invalid variant ID. Must be a valid integer.',
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
                  });
            }
            next();
      };
}

function validateCategoryMiddleware(req, res, next) {
      if (req.method === 'POST' || req.method === 'PUT') {
            const { name, parent_id } = req.body;

            if (!name) {
                  return res.error('Category name is required', 400);
            }

            if (parent_id !== undefined && parent_id !== null) {
                  if (!Number.isInteger(Number(parent_id)) || Number(parent_id) <= 0) {
                        return res.error('Parent ID must be a positive integer', 400);
                  }
            }
      }

      next();
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
            res.json(health);
      } catch (error) {
            logger.error('Health check failed', { error: error.message });
            res.status(500).json({ error: 'Health check failed' });
      }
}

async function createProductController(req, res) {
      try {
            const result = await createProduct(req.body);
            res.success(result.rows[0], 'Product created successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductByIdController(req, res) {
      try {
            const result = await getProductById(req.params.id);
            if (result.rows.length === 0) {
                  return res.error('Product not found', 404);
            }

            res.success(result.rows[0]);
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

async function createCategoryController(req, res) {
      try {
            const result = await createCategory(req.body);
            if (result.rows.length === 0) {
                  return res.error('A category with this name or slug already exists', 409);
            }
            res.success(result.rows[0], 'Category created successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getCategoryTreeController(req, res) {
      try {
            const result = await getCategoryTree();
            res.success(result.rows);
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

async function getCategoriesController(req, res) {
      try {
            const { page, limit, offset } = req.pagination;

            const parentQuery = `
            SELECT c.*, 
                   (SELECT COUNT(*) FROM products WHERE category_id = c.id AND deleted_at IS NULL) as product_count,
                   (SELECT COUNT(*) FROM categories WHERE parent_id = c.id AND deleted_at IS NULL) as subcategory_count
            FROM categories c
            WHERE c.parent_id IS NULL AND c.deleted_at IS NULL
            ORDER BY c.name
            LIMIT $1 OFFSET $2
        `;

            const parentResult = await pgPool.query(parentQuery, [limit, offset]);

            const countResult = await pgPool.query('SELECT COUNT(*) FROM categories WHERE parent_id IS NULL AND deleted_at IS NULL');
            const total = parseInt(countResult.rows[0].count);

            const parentIds = parentResult.rows.map(cat => cat.id);
            const childQuery = `
            WITH RECURSIVE category_tree AS (
                -- Base case: direct children of parent categories
                SELECT 
                    id, 
                    name, 
                    parent_id, 
                    1 as level,
                    ARRAY[parent_id] as parent_path
                FROM categories
                WHERE parent_id = ANY($1) AND deleted_at IS NULL
                
                UNION ALL
                
                -- Recursive case: children of children
                SELECT 
                    c.id, 
                    c.name, 
                    c.parent_id, 
                    ct.level + 1,
                    ct.parent_path || c.parent_id
                FROM categories c
                JOIN category_tree ct ON c.parent_id = ct.id
                WHERE c.deleted_at IS NULL
            )
            SELECT 
                ct.*,
                (SELECT COUNT(*) FROM products WHERE category_id = ct.id AND deleted_at IS NULL) as product_count,
                (SELECT COUNT(*) FROM categories WHERE parent_id = ct.id AND deleted_at IS NULL) as subcategory_count
            FROM category_tree ct
            ORDER BY ct.parent_path, ct.name
        `;

            const childResult = await pgPool.query(childQuery, [parentIds]);

            const categories = parentResult.rows.map(parent => {
                  const children = childResult.rows
                        .filter(child => {
                              return child.parent_path.includes(parent.id);
                        })
                        .map(child => ({
                              ...child,
                              parent_path: undefined,
                        }));

                  return {
                        ...parent,
                        children,
                  };
            });

            res.success({
                  items: categories,
                  pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                  },
            });
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
            await invalidateCachePattern(`/users/${userId}/wishlist`);
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
            await invalidateCachePattern(`/chats/${req.params.chatId}/messages`);
            res.success(result.rows[0], 'Chat message added successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getChatMessagesController(req, res) {
      try {
            const result = await getChatMessages(req.params.chatId, req.pagination);
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

async function markChatMessagesAsReadController(req, res) {
      try {
            const result = await markChatMessagesAsRead(req.params.chatId, req.body.user_id);
            await invalidateCachePattern(`/chats/${req.params.chatId}/messages`);
            res.success(result.rows, 'Chat messages marked as read successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductAnalyticsController(req, res) {
      try {
            const result = await getProductAnalytics(req.params.productId);
            if (result.rows.length === 0) {
                  return res.error('Product not found', 404);
            }
            res.success(result.rows[0]);
      } catch (error) {
            res.error(error);
      }
}

async function getCategoryAnalyticsController(req, res) {
      try {
            const result = await getCategoryAnalytics(req.params.categoryId);
            if (result.rows.length === 0) {
                  return res.error('Category not found', 404);
            }
            res.success(result.rows[0]);
      } catch (error) {
            res.error(error);
      }
}

async function getProductAttributesController(req, res) {
      try {
            const result = await getProductAttributes(req.params.productId);
            res.success(result.rows);
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
            res.success(result.rows[0]);
      } catch (error) {
            res.error(error);
      }
}

async function updateCategoryController(req, res) {
      try {
            const result = await updateCategory(req.params.id, req.body);
            if (result.rows.length === 0) {
                  // Check if the category exists
                  const categoryExists = await getCategoryById(req.params.id);
                  if (categoryExists.rows.length === 0) {
                        return res.error('Category not found', 404);
                  }
                  return res.error('A category with this name or slug already exists', 409);
            }
            res.success(result.rows[0], 'Category updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function deleteCategoryController(req, res) {
      try {
            const result = await deleteCategory(req.params.id);
            if (result.rows.length === 0) {
                  return res.error('Category not found', 404);
            }

            res.success(result.rows[0], 'Category deleted successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getCategoryByIdController(req, res) {
      try {
            const result = await getCategoryById(req.params.id);
            if (result.rows.length === 0) {
                  return res.error('Category not found', 404);
            }

            res.success(result.rows[0]);
      } catch (error) {
            res.error(error);
      }
}

async function searchCategoriesController(req, res) {
      try {
            const result = await searchCategories(req.query, req.pagination);
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

async function bulkUpdateCategoriesController(req, res) {
      try {
            const result = await bulkUpdateCategories(req.body.categories);

            res.success(result, 'Categories updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function updateProductController(req, res) {
      try {
            const result = await updateProduct(req.params.id, req.body);
            if (result.rows.length === 0) {
                  return res.status(404).json({
                        error: 'Product not found or already deleted',
                  });
            }

            res.success(result.rows[0], 'Product updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function deleteProductController(req, res) {
      try {
            const result = await deleteProduct(req.params.id);
            if (result.rows.length === 0) {
                  return res.status(404).json({
                        error: 'Product not found or already deleted',
                  });
            }

            res.success(result.rows[0], 'Product deleted successfully');
      } catch (error) {
            res.error(error);
      }
}

async function updateProductStatusController(req, res) {
      try {
            const result = await updateProductStatus(req.params.id, req.body.status);
            if (result.rows.length === 0) {
                  return res.status(404).json({
                        error: 'Product not found or already deleted',
                  });
            }
            res.success(result.rows[0], 'Product status updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function bulkUpdateProductStatusController(req, res) {
      try {
            const { productIds, status } = req.body;
            if (!Array.isArray(productIds) || productIds.length === 0) {
                  return res.status(400).json({
                        error: 'Invalid product IDs array',
                  });
            }
            const result = await bulkUpdateProductStatus(productIds, status);
            res.success(result.rows, 'Product statuses updated successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getProductStatisticsController(req, res) {
      try {
            const result = await getProductStatistics();
            res.success(result.rows[0], 'Product statistics retrieved successfully');
      } catch (error) {
            res.error(error);
      }
}

async function getCategoryBySlugController(req, res) {
      try {
            const result = await getCategoryBySlug(req.params.slug);
            if (result.rows.length === 0) {
                  return res.error('Category not found', 404);
            }
            res.success(result.rows[0]);
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
