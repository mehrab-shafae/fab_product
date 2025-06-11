import 'dotenv/config';
// ======================================================================
import express from 'express';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createClient } from 'redis';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import Bull from 'bull';
import { gzip, gunzip } from 'zlib';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import expressValidator from 'express-validator';
import { createLogger, format, transports } from 'winston';
import { body, param, query, validationResult } from 'express-validator';
import helmet from 'helmet';
import xss from 'xss-clean';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import YAML from 'yamljs';

// ======================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaConfig = JSON.parse(readFileSync(join(__dirname, 'database-schema.json'), 'utf8'));
// ======================================================================
const PORT = process.env.PORT || 3000;
const POSTGRES_URI =
    process.env.POSTGRES_URI ||
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${
        process.env.POSTGRES_HOST || 'localhost'
    }:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'product_db'}`;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/product_db';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

let redisClient = null;
let redisConnected = false;

const CACHE_VERSION = 'v1';
const CACHE_PATTERNS = {
    PRODUCT: {
        SEARCH: 'api:products:search:*',
        DETAILS: 'api:products:${id}:*',
        REVIEWS: 'api:products:${id}:reviews:*',
        PRICE: 'api:products:${id}:price:*',
        ANALYTICS: 'api:products:${id}:analytics:*',
        VARIANTS: 'api:products:${id}:variants:*',
        IMAGES: 'api:products:${id}:images:*',
        INVENTORY: 'api:products:${id}:inventory:*',
        ATTRIBUTES: 'api:products:${id}:attributes:*',
        RELATIONSHIPS: 'api:products:${id}:relationships:*',
        VERSIONS: 'api:products:${id}:versions:*',
    },
    CATEGORY: {
        TREE: 'api:categories:tree:*',
        DETAILS: 'api:categories:${id}:*',
    },
    USER: {
        WISHLIST: 'api:users:${id}:wishlist:*',
    },
    CHAT: {
        MESSAGES: 'api:chats:${id}:messages:*',
    },
};

const { combine, timestamp, printf, colorize } = format;

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
logger.debug = function (message, metadata = {}) {
    if (DEBUG_MODE) {
        this.info(message, { ...metadata, debug: true });
    }
};

async function initializeRedis() {
    const ONE_HOUR = 60 * 60 * 1000;
    let retryTimer = null;
    let isReconnecting = false;

    const connectToRedis = async () => {
        if (isReconnecting) return false;
        isReconnecting = true;

        try {
            logger.info('Attempting to connect to Redis', { uri: REDIS_URI });
            redisClient = createClient({
                url: REDIS_URI,
                socket: {
                    reconnectStrategy: retries => {
                        if (retries > 3) {
                            logger.error('Redis max retries reached');
                            return new Error('Redis max retries reached');
                        }
                        return Math.min(retries * 100, 3000);
                    },
                },
            });

            redisClient.on('error', err => {
                logger.error('Redis connection error', { error: err.message });
                redisConnected = false;
                if (!retryTimer) {
                    retryTimer = setInterval(connectToRedis, ONE_HOUR);
                }
            });

            redisClient.on('connect', () => {
                logger.info('Successfully connected to Redis');
                redisConnected = true;
                if (retryTimer) {
                    clearInterval(retryTimer);
                    retryTimer = null;
                }
            });

            redisClient.on('end', () => {
                logger.info('Redis connection ended');
                redisConnected = false;
                if (!retryTimer) {
                    retryTimer = setInterval(connectToRedis, ONE_HOUR);
                }
            });

            await redisClient.connect();
            isReconnecting = false;
            return true;
        } catch (error) {
            logger.error('Failed to connect to Redis', { error: error.message });
            redisConnected = false;
            if (!retryTimer) {
                retryTimer = setInterval(connectToRedis, ONE_HOUR);
            }
            isReconnecting = false;
            return false;
        }
    };

    return connectToRedis();
}

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
});

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: (used, req) => {
        const delayAfter = req.slowDown.limit;
        return (used - delayAfter) * 500;
    },
});

const CACHE_PREFIXES = {
    PRODUCT: 'product:',
    CATEGORY: 'category:',
    TAG: 'tag:',
    COMMENT: 'comment:',
    CHAT: 'chat:',
    ANALYTICS: 'analytics:',
};

const CACHE_TTL = {
    PRODUCT: 3600,
    CATEGORY: 7200,
    USER: 1800,
    CHAT: 300,
    TAG: 3600,
    COMMENT: 1800,
    ANALYTICS: 3600,
};

const swaggerDocument = YAML.parse(readFileSync(join(__dirname, 'swagger.yaml'), 'utf8'));

swaggerDocument.info.title = 'Product Microservice API';
swaggerDocument.info.description = 'API for managing products and related features';
swaggerDocument.servers[0].description = 'Development server';

const pgPool = new Pool({
    connectionString: POSTGRES_URI,
});

const mongoClient = new MongoClient(MONGO_URI);
// ======================================================================

const CACHE_COMPRESSION_THRESHOLD = 1024;
const BATCH_SIZE = 1000;
const MAX_CONCURRENT_JOBS = 5;

const productUpdateQueue = new Bull('product-updates', REDIS_URI);
const cacheWarmingQueue = new Bull('cache-warming', REDIS_URI);
const bulkOperationQueue = new Bull('bulk-operations', REDIS_URI);

async function clearCorruptedCache() {
    try {
        logger.info('Clearing corrupted cache');
        if (redisClient) {
            await redisClient.flushAll();
            logger.debug('Redis cache cleared');
        }
        logger.debug('Memory cache cleared');
        logger.info('Cache cleared successfully');
    } catch (error) {
        logger.error('Error clearing cache', {
            error: error.message,
            stack: error.stack,
        });
    }
}

function enhancedCacheMiddleware(prefix, ttl, options = {}) {
    const {
        compress = true,
        version = '1',
        maxRetries = 2,
        retryDelay = 100,
        compressionThreshold = 1024,
        cacheKeyPrefix = 'cache',
        maxCacheSize = 10 * 1024 * 1024,
        staleWhileRevalidate = false,
        staleTTL = 60,
    } = options;

    return async function (req, res, next) {
        if (req.method !== 'GET') {
            return next();
        }

        if (!redisConnected) {
            logger.warn('Redis not connected, skipping cache', {
                path: req.originalUrl,
                method: req.method,
            });
            return next();
        }

        const key = `${cacheKeyPrefix}:${prefix}:${version}:${req.originalUrl}`;
        let retryCount = 0;

        const getFromCache = async () => {
            try {
                if (!redisClient.isOpen) {
                    logger.warn('Redis client is closed, skipping cache', { key });
                    return null;
                }

                const cachedData = await redisClient.get(key);
                if (!cachedData) return null;

                const metadata = await redisClient.hGetAll(`${key}:meta`);

                let data;
                if (metadata.compressed === 'true') {
                    data = await decompressData(cachedData);
                } else {
                    data = cachedData;
                }

                const result = {
                    data: JSON.parse(data),
                    metadata: {
                        created: parseInt(metadata.created) || Date.now(),
                        size: parseInt(metadata.size) || 0,
                        compressed: metadata.compressed === 'true',
                        isStale: staleWhileRevalidate && Date.now() - parseInt(metadata.created) > ttl * 1000,
                    },
                };

                if (result.metadata.isStale && staleWhileRevalidate) {
                    setInCache(result.data).catch(error => {
                        logger.error('Background cache refresh error', {
                            error: error.message,
                            key,
                        });
                    });
                }

                return result;
            } catch (error) {
                logger.error('Cache retrieval error', {
                    error: error.message,
                    key,
                    retryCount,
                });
                return null;
            }
        };

        const setInCache = async data => {
            try {
                if (!redisClient.isOpen) {
                    logger.warn('Redis client is closed, skipping cache set', { key });
                    return;
                }

                const dataStr = JSON.stringify(data);
                let finalData = dataStr;
                let isCompressed = false;

                if (Buffer.byteLength(dataStr) > maxCacheSize) {
                    logger.warn('Data too large for caching', {
                        key,
                        size: Buffer.byteLength(dataStr),
                        maxSize: maxCacheSize,
                    });
                    return;
                }

                if (compress && dataStr.length > compressionThreshold) {
                    finalData = await compressData(dataStr);
                    isCompressed = true;
                }

                const multi = redisClient.multi();

                multi.setEx(key, ttl, finalData);

                multi.hSet(`${key}:meta`, {
                    created: Date.now().toString(),
                    size: finalData.length.toString(),
                    compressed: isCompressed.toString(),
                });
                multi.expire(`${key}:meta`, ttl);

                await multi.exec();

                logger.debug('Data cached successfully', {
                    key,
                    size: finalData.length,
                    compressed: isCompressed,
                });
            } catch (error) {
                logger.error('Cache storage error', {
                    error: error.message,
                    key,
                    stack: error.stack,
                });
            }
        };

        while (retryCount <= maxRetries) {
            const cachedResult = await getFromCache();
            if (cachedResult) {
                if (cachedResult.metadata.isStale && staleWhileRevalidate) {
                    logger.debug('Returning stale data while revalidating', {
                        key,
                        age: Date.now() - cachedResult.metadata.created,
                    });
                }
                return res.json(cachedResult.data);
            }

            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount)));
                retryCount++;
            } else {
                break;
            }
        }

        res.sendResponse = res.json;
        res.json = async function (body) {
            try {
                setInCache(body).catch(error => {
                    logger.error('Async cache storage error', {
                        error: error.message,
                        key,
                    });
                });
            } catch (error) {
                logger.error('Cache middleware error', {
                    error: error.message,
                    key,
                });
            }
            res.sendResponse(body);
        };
        next();
    };
}

async function compressData(data) {
    return new Promise((resolve, reject) => {
        if (!data || typeof data !== 'string') {
            reject(new Error('Invalid data format for compression'));
            return;
        }

        const buffer = Buffer.from(data);
        if (buffer.length < CACHE_COMPRESSION_THRESHOLD) {
            resolve(data);
            return;
        }

        gzip(
            buffer,
            {
                level: 6,
                memLevel: 8,
                windowBits: 15,
            },
            (err, result) => {
                if (err) {
                    logger.error('Compression error', {
                        error: err.message,
                        originalSize: buffer.length,
                    });
                    resolve(data);
                } else {
                    resolve(result.toString('base64'));
                }
            }
        );
    });
}

async function decompressData(data) {
    return new Promise((resolve, reject) => {
        try {
            if (!data) {
                reject(new Error('Empty data for decompression'));
                return;
            }

            const isCompressed = data.startsWith('H4sI');
            if (!isCompressed) {
                resolve(data);
                return;
            }

            const buffer = Buffer.from(data, 'base64');
            gunzip(
                buffer,
                {
                    windowBits: 15,
                },
                (err, result) => {
                    if (err) {
                        logger.error('Decompression error', {
                            error: err.message,
                            dataLength: data.length,
                        });
                        reject(err);
                    } else {
                        resolve(result.toString('utf8'));
                    }
                }
            );
        } catch (error) {
            logger.error('Decompression preparation error', {
                error: error.message,
                dataLength: data?.length,
            });
            reject(error);
        }
    });
}

async function getCachedData(key, fetchData, ttl) {
    try {
        if (!redisConnected) {
            logger.debug('Redis not connected, fetching data directly', { key });
            return await fetchData();
        }

        const cachedData = await redisClient.get(key);
        if (cachedData) {
            logger.debug('Cache hit', { key });
            return JSON.parse(cachedData);
        }

        logger.debug('Cache miss, fetching data', { key });
        const data = await fetchData();
        if (redisConnected) {
            await redisClient.setEx(key, ttl, JSON.stringify(data));
            logger.debug('Data cached', { key, ttl });
        }
        return data;
    } catch (error) {
        logger.error('Cache error', {
            error: error.message,
            stack: error.stack,
            key,
        });
        return fetchData();
    }
}

function validateProductId(req, res, next) {
    const productId = req.params.id;
    if (!productId || isNaN(parseInt(productId))) {
        return res.status(400).json({
            error: 'Invalid product ID. Must be a valid integer.',
        });
    }
    next();
}

async function invalidateCachePattern(pattern, options = {}) {
    const { maxRetries = 3, retryDelay = 1000, batchSize = 100 } = options;

    if (!redisConnected || !redisClient.isOpen) {
        logger.warn('Redis not connected, skipping cache invalidation', { pattern });
        return;
    }

    let retries = 0;
    while (retries < maxRetries) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length === 0) {
                logger.debug('No cache keys found to invalidate', { pattern });
                return;
            }

            for (let i = 0; i < keys.length; i += batchSize) {
                const batch = keys.slice(i, i + batchSize);
                const multi = redisClient.multi();

                batch.forEach(key => {
                    multi.del(key);

                    multi.del(`${key}:meta`);
                });

                await multi.exec();

                logger.debug('Cache batch invalidated', {
                    pattern,
                    batchSize: batch.length,
                    totalProcessed: Math.min(i + batchSize, keys.length),
                    totalKeys: keys.length,
                });
            }

            logger.info('Cache invalidated successfully', {
                pattern,
                keysCount: keys.length,
            });
            return;
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                logger.error('Failed to invalidate cache after maximum retries', {
                    pattern,
                    error: error.message,
                    retries,
                });
                throw new Error(`Failed to invalidate cache after ${maxRetries} attempts: ${error.message}`);
            }

            logger.warn('Cache invalidation attempt failed, retrying', {
                pattern,
                error: error.message,
                attempt: retries,
                nextAttemptIn: retryDelay,
            });

            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

async function invalidateCachePatterns(patterns, options = {}) {
    if (!Array.isArray(patterns) || patterns.length === 0) {
        logger.warn('No patterns provided for cache invalidation');
        return;
    }

    try {
        await Promise.all(patterns.map(pattern => invalidateCachePattern(pattern, options)));
        logger.info('Multiple cache patterns invalidated successfully', { patterns });
    } catch (error) {
        logger.error('Failed to invalidate multiple cache patterns', {
            patterns,
            error: error.message,
        });
        throw error;
    }
}

async function warmCache() {
    if (!redisConnected || !redisClient.isOpen) {
        logger.warn('Redis not connected, skipping cache warm-up');
        return;
    }

    const warmUpTasks = [
        {
            name: 'Product Search',
            pattern: CACHE_PATTERNS.PRODUCT.SEARCH,
            fetchData: async () => {
                const result = await searchProducts({ limit: 100 });
                return result.items || [];
            },
        },
        {
            name: 'Category Tree',
            pattern: CACHE_PATTERNS.CATEGORY.TREE,
            fetchData: async () => {
                const result = await getCategoryTree();
                return result.rows || [];
            },
        },
    ];

    logger.info('Starting cache warm-up');

    for (const task of warmUpTasks) {
        try {
            logger.debug(`Warming up ${task.name} cache`);

            await invalidateCachePattern(task.pattern);

            const data = await task.fetchData();
            if (!data || !Array.isArray(data)) {
                logger.warn(`No data returned for ${task.name}, skipping cache warm-up`);
                continue;
            }

            const key = task.pattern.replace('*', 'warm');
            const ttl = CACHE_TTL[task.name.split(' ')[0].toUpperCase()] || CACHE_TTL.PRODUCT;

            await redisClient.setEx(key, ttl, JSON.stringify(data));

            await redisClient.hSet(`${key}:meta`, {
                created: Date.now().toString(),
                size: JSON.stringify(data).length.toString(),
                compressed: 'false',
            });
            await redisClient.expire(`${key}:meta`, ttl);

            logger.info(`${task.name} cache warmed up successfully`, {
                key,
                dataSize: data.length,
            });
        } catch (error) {
            logger.error(`Failed to warm up ${task.name} cache`, {
                error: error.message,
                stack: error.stack,
            });
        }
    }

    logger.info('Cache warm-up completed');
}

cacheWarmingQueue.process('warm-products', async job => {
    const { limit } = job.data;
    const client = await pgPool.connect();

    try {
        const products = await client.query('SELECT id FROM products ORDER BY created_at DESC LIMIT $1', [limit]);

        for (const product of products.rows) {
            const key = `${CACHE_PREFIXES.PRODUCT}${product.id}`;
            const data = await getProductById(product.id);

            if (data?.rows?.[0]) {
                const dataToCache = JSON.stringify(data.rows[0]);

                const multi = redisClient.multi();
                multi.setEx(key, CACHE_TTL.PRODUCT, dataToCache);

                multi.hSet(`${key}:meta`, {
                    created: Date.now(),
                    size: dataToCache.length,
                    type: 'product',
                });
                multi.expire(`${key}:meta`, CACHE_TTL.PRODUCT);

                await multi.exec();
            }
        }

        logger.info('Products cache warmed', {
            count: products.rows.length,
        });
    } catch (error) {
        logger.error('Product cache warming error', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    } finally {
        client.release();
    }
});

cacheWarmingQueue.process('preload-related', async job => {
    const { productId, types } = job.data;

    for (const type of types) {
        const key = `${CACHE_PREFIXES.PRODUCT}${productId}:${type}`;
        let data;

        switch (type) {
            case 'variants':
                data = await getProductVariants(productId);
                break;
            case 'images':
                data = await getProductImages(productId);
                break;
            case 'reviews':
                data = await getProductReviews(productId);
                break;
        }

        if (data && redisConnected) {
            await redisClient.setEx(key, CACHE_TTL.PRODUCT, JSON.stringify(data.rows));
        }
    }
});

async function processBulkProductUpdate(products) {
    const chunks = [];
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        chunks.push(products.slice(i, i + BATCH_SIZE));
    }

    const results = [];
    for (const chunk of chunks) {
        const result = await bulkOperationQueue.add(
            'update-products',
            {
                products: chunk,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            }
        );
        results.push(result);
    }

    return results;
}

bulkOperationQueue.process('update-products', async job => {
    const { products } = job.data;
    const client = await pgPool.connect();

    try {
        await client.query('BEGIN');

        for (const product of products) {
            await client.query(
                `UPDATE products 
                 SET name = $1, description = $2, price = $3, 
                     category_id = $4, metadata = $5, updated_at = NOW()
                 WHERE id = $6`,
                [product.name, product.description, product.price, product.category_id, product.metadata, product.id]
            );
        }

        await client.query('COMMIT');

        await invalidateCachePattern(`${CACHE_PREFIXES.PRODUCT}*`);

        return { success: true, count: products.length };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

function scheduleCacheWarming() {
    setInterval(warmCache, 4 * 60 * 60 * 1000);
}

async function init() {
    const app = express();

    await initializeRedis();

    app.use(helmet());
    app.use(xss());
    app.use(hpp());
    app.use(mongoSanitize());
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ limit: '1mb', extended: true }));
    app.use(limiter);
    app.use(speedLimiter);

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

    app.use('/api-docs/fa', express.static(join(__dirname, 'docs-fa.html')));

    app.get('/api-docs', (req, res) => {
        res.redirect('/api-docs/en');
    });

    app.get('/health', async (req, res) => {
        try {
            const result = await pgPool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'products'
                );
            `);

            if (!result.rows[0].exists) {
                return res.status(503).json({ status: 'initializing', message: 'Database schema is being created' });
            }

            const indexResult = await pgPool.query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE tablename = 'products'
                    AND indexname = 'idx_products_name_trgm'
                );
            `);

            if (!indexResult.rows[0].exists) {
                return res.status(503).json({ status: 'initializing', message: 'Database indexes are being created' });
            }

            res.json({ status: 'ready', message: 'Server is ready to handle requests' });
        } catch (error) {
            console.error('Health check failed:', error);
            res.status(500).json({ status: 'error', message: 'Health check failed' });
        }
    });

    try {
        await createDatabaseSchema();

        if (false) optimizeSystemForService();

        await setupMongoCollections();
        await createMaterializedViews();
        await createOptimizedIndexes();

        await createMaterializedViewIndexes();
        await refreshMaterializedViews();
        scheduleMaterializedViewRefresh();
        scheduleCacheWarming();
        await warmCache();

        console.log('Database initialization completed successfully');
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }

    app.get('/jobs/:jobId/status', async function (req, res) {
        try {
            const job = await bulkOperationQueue.getJob(req.params.jobId);
            if (!job) {
                return res.status(404).json({ error: 'Job not found' });
            }

            const state = await job.getState();
            const progress = job._progress;
            const result = job.returnvalue;

            res.json({
                id: job.id,
                state,
                progress,
                result,
                attemptsMade: job.attemptsMade,
                timestamp: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/products', async function (req, res) {
        try {
            const result = await createProduct(req.body);

            await Promise.all([invalidateCachePattern('api:products:search:*'), invalidateCachePattern('api:categories:tree:*')]);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:id',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductById(req.params.id)
                .then(result => {
                    if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'Product not found' });
                    }
                    res.json(result.rows[0]);
                })
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get('/products', paginateResults, async function (req, res) {
        try {
            const searchParams = {
                page: req.pagination.page,
                pageSize: req.pagination.limit,
                ...req.query,
            };

            const result = await searchProducts(searchParams);

            res.json({
                data: result.items,
                pagination: result.pagination,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/products/bulk-update', async function (req, res) {
        try {
            const { type, data, options } = req.body;

            if (!BULK_OPERATION_TYPES[type.toUpperCase()]) {
                return res.status(400).json({ error: 'Invalid operation type' });
            }

            if (!Array.isArray(data) || data.length === 0) {
                return res.status(400).json({ error: 'Invalid data array' });
            }

            const results = await processBulkOperation(type, data, options);
            res.json({
                message: 'Bulk operation queued successfully',
                jobIds: results.map(r => r.id),
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/categories', async function (req, res) {
        try {
            const result = await createCategory(req.body);

            await Promise.all([invalidateCachePattern('api:categories:tree:*'), invalidateCachePattern('api:products:search:*')]);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/categories/tree',
        enhancedCacheMiddleware(CACHE_PREFIXES.CATEGORY, CACHE_TTL.CATEGORY, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getCategoryTree()
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/products/:productId/comments', async function (req, res) {
        try {
            const commentData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addComment(commentData);
            await invalidateCachePattern(`/products/${req.params.productId}/comments`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/comments',
        enhancedCacheMiddleware(CACHE_PREFIXES.COMMENT, CACHE_TTL.COMMENT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductComments(req.params.productId)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/products/:productId/tags', async function (req, res) {
        try {
            const { tag_name } = req.body;
            const result = await addTagToProduct(req.params.productId, tag_name);
            await invalidateCachePattern(`/products/tags/${tag_name}`);
            await invalidateCachePattern(`/products/${req.params.productId}`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/tags/:tagName',
        enhancedCacheMiddleware(CACHE_PREFIXES.TAG, CACHE_TTL.TAG, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductsByTag(req.params.tagName)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get(
        '/products/search/document',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            try {
                const { q } = req.query;
                if (!q) {
                    return res.status(400).json({ error: 'Search query is required' });
                }
                searchProductDocuments(q)
                    .then(results => res.json(results))
                    .catch(error => res.status(500).json({ error: error.message }));
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    app.get(
        '/products/search',
        paginateResults,
        enhancedCacheMiddleware('products:search', 300, {
            compress: true,
            version: '1',
            cacheKeyPrefix: 'api',
        }),
        async function (req, res) {
            try {
                const { page, limit, offset } = req.pagination;
                const { name, category_id, min_price, max_price } = req.query;

                let query = 'SELECT * FROM products WHERE deleted_at IS NULL';
                const params = [];
                let paramIndex = 1;

                if (name) {
                    query += ` AND name ILIKE $${paramIndex}`;
                    params.push(`%${name}%`);
                    paramIndex++;
                }

                if (category_id) {
                    query += ` AND p.category_id = $${paramIndex}`;
                    params.push(category_id);
                    paramIndex++;
                }

                if (min_price) {
                    query += ` AND price >= $${paramIndex}`;
                    params.push(min_price);
                    paramIndex++;
                }

                if (max_price) {
                    query += ` AND price <= $${paramIndex}`;
                    params.push(max_price);
                    paramIndex++;
                }

                query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
                params.push(limit, offset);

                const result = await pgPool.query(query, params);
                const countResult = await pgPool.query(query.replace('SELECT *', 'SELECT COUNT(*)').split('ORDER BY')[0], params.slice(0, -2));
                const total = parseInt(countResult.rows[0].count);

                res.json({
                    data: result.rows,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit),
                    },
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    app.post('/products/:productId/chats', async function (req, res) {
        try {
            const chatData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await createProductChat(chatData);
            await invalidateCachePattern(`/products/${req.params.productId}/chats`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/users/:userId/chats',
        enhancedCacheMiddleware(CACHE_PREFIXES.CHAT, CACHE_TTL.CHAT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        async (req, res) => {
            try {
                const { userId } = req.params;
                const chats = await getProductChats(userId);
                res.json(chats);
            } catch (error) {
                console.error('Error getting user chats:', error);
                res.status(500).json({ error: 'Failed to get user chats' });
            }
        }
    );

    app.post('/chats/:chatId/messages', async function (req, res) {
        try {
            const messageData = {
                ...req.body,
                chat_id: req.params.chatId,
            };
            const result = await addChatMessage(messageData);
            await invalidateCachePattern(`/chats/${req.params.chatId}/messages`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/chats/:chatId/messages',
        enhancedCacheMiddleware(CACHE_PREFIXES.CHAT, CACHE_TTL.CHAT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getChatMessages(req.params.chatId)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/chats/:chatId/read', async function (req, res) {
        try {
            const result = await markChatMessagesAsRead(req.params.chatId, req.body.user_id);
            await invalidateCachePattern(`/chats/${req.params.chatId}/messages`);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/analytics',
        enhancedCacheMiddleware(CACHE_PREFIXES.ANALYTICS, CACHE_TTL.ANALYTICS, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductAnalytics(req.params.productId)
                .then(result => {
                    if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'Product not found' });
                    }
                    res.json(result.rows[0]);
                })
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get(
        '/categories/:categoryId/analytics',
        enhancedCacheMiddleware(CACHE_PREFIXES.ANALYTICS, CACHE_TTL.ANALYTICS, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getCategoryAnalytics(req.params.categoryId)
                .then(result => {
                    if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'Category not found' });
                    }
                    res.json(result.rows);
                })
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get(
        '/products/:productId/recommendations',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductRecommendations(req.params.productId)
                .then(result => res.json(result))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/products/:productId/variants', async function (req, res) {
        try {
            const variantData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await createProductVariant(variantData);
            await invalidateCachePattern(`/products/${req.params.productId}/variants`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/variants',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductVariants(req.params.productId)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/products/:productId/images', async function (req, res) {
        try {
            const imageData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addProductImage(imageData);
            await invalidateCachePattern(`/products/${req.params.productId}/images`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/images',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductImages(req.params.productId)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/products/:productId/inventory', async function (req, res) {
        try {
            const inventoryData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await updateInventory(inventoryData);
            await invalidateCachePattern(`/products/${req.params.productId}/inventory`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/products/:productId/reviews', async function (req, res) {
        try {
            const reviewData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addProductReview(reviewData);

            await Promise.all([
                invalidateCachePattern(`api:products:reviews:${req.params.productId}:*`),
                invalidateCachePattern(`api:products:analytics:${req.params.productId}:*`),
            ]);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/reviews',
        paginateResults,
        enhancedCacheMiddleware('products:reviews', 300, {
            compress: true,
            version: '1',
            cacheKeyPrefix: 'api',
        }),
        async function (req, res) {
            try {
                const { page, limit } = req.pagination;
                const reviews = await getProductReviews(req.params.productId, { page, limit });
                res.json(reviews);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    app.post('/users/:userId/wishlist', async (req, res) => {
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
    });

    app.get(
        '/users/:userId/wishlist',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        async (req, res) => {
            try {
                const { userId } = req.params;
                const wishlist = await getWishlist(userId);
                res.json(wishlist);
            } catch (error) {
                console.error('Error getting wishlist:', error);
                res.status(500).json({ error: 'Failed to get wishlist' });
            }
        }
    );

    app.get('/health', function (req, res) {
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                postgres: pgPool ? 'connected' : 'disconnected',
                redis: {
                    status: redisConnected ? 'connected' : 'disconnected',
                    lastError: redisClient ? redisClient.lastError : null,
                },
                mongo: mongoClient ? 'connected' : 'disconnected',
            },
            cache: {
                enabled: redisConnected,
                warming: {
                    lastRun: new Date(),
                    status: redisConnected ? 'active' : 'disabled',
                },
            },
        };
        res.json(health);
    });

    app.post('/products/:productId/attributes', async function (req, res) {
        try {
            const attributeData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addProductAttributeValue(attributeData);
            await invalidateCachePattern(`/products/${req.params.productId}/attributes`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/attributes', async function (req, res) {
        try {
            const result = await createProductAttribute(req.body);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/attributes',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductAttributes(req.params.productId)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get(
        '/products/:productId/price-history',
        enhancedCacheMiddleware('products:price-history', 1800, {
            compress: true,
            version: '1',
            cacheKeyPrefix: 'api',
        }),
        async function (req, res) {
            try {
                const history = await getProductPriceHistory(req.params.productId);
                res.json(history);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    app.get(
        '/products/:productId/price-statistics',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductPriceStatistics(req.params.productId, req.query.variant_id)
                .then(result => res.json(result.rows[0]))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get(
        '/products/:id/price-trends',
        validateProductId,
        enhancedCacheMiddleware('product', 300, {
            compress: true,
            cacheKeyPrefix: 'api',
        }),
        async (req, res) => {
            try {
                const productId = parseInt(req.params.id);
                const variantId = req.query.variant_id ? parseInt(req.query.variant_id) : null;
                const period = req.query.period || '30 days';

                if (variantId && isNaN(variantId)) {
                    return res.status(400).json({
                        error: 'Invalid variant ID. Must be a valid integer.',
                    });
                }

                const trends = await getProductPriceTrends(productId, variantId, period);
                res.json(trends);
            } catch (error) {
                logger.error('Price trends error', {
                    error: error.message,
                    productId: req.params.id,
                    variantId: req.query.variant_id,
                    period: req.query.period,
                });
                res.status(500).json({ error: error.message });
            }
        }
    );

    app.post('/products/:productId/price-history', async function (req, res) {
        try {
            const priceData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addPriceHistory(priceData);

            await Promise.all([
                invalidateCachePattern(`api:products:price-history:${req.params.productId}:*`),
                invalidateCachePattern(`api:products:analytics:${req.params.productId}:*`),
            ]);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/products/:productId/relationships', async function (req, res) {
        try {
            const relationshipData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addProductRelationship(relationshipData);
            await invalidateCachePattern(`/products/${req.params.productId}/relationships`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/relationships',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductRelationships(req.params.productId, req.query.relationship_type)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.post('/products/:productId/versions', async function (req, res) {
        try {
            const versionData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await createProductVersion(versionData);
            await invalidateCachePattern(`/products/${req.params.productId}/versions`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get(
        '/products/:productId/versions',
        enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT, {
            compress: true,
            useMemoryCache: true,
            preloadRelated: true,
            version: '1',
        }),
        function (req, res) {
            getProductVersions(req.params.productId)
                .then(result => res.json(result.rows))
                .catch(error => res.status(500).json({ error: error.message }));
        }
    );

    app.get('/categories', paginateResults, async function (req, res) {
        try {
            const { page, limit, offset } = req.pagination;
            const result = await pgPool.query('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name LIMIT $1 OFFSET $2', [limit, offset]);
            const countResult = await pgPool.query('SELECT COUNT(*) FROM categories WHERE deleted_at IS NULL');
            const total = parseInt(countResult.rows[0].count);

            res.json({
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

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

function scheduleMaterializedViewRefresh() {
    setInterval(refreshMaterializedViews, 60 * 60 * 1000);
}

function executeLinuxCommand(command) {
    try {
        return execSync(command, { encoding: 'utf-8' });
    } catch (error) {
        console.error('Linux command execution failed:', error);
        throw error;
    }
}

function optimizeSystemForService() {
    executeLinuxCommand('ulimit -n 65535');

    executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = 500;"');
    executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = 2GB;"');
    executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET effective_cache_size = 6GB;"');
    executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET maintenance_work_mem = 512MB;"');
    executeLinuxCommand('sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = 16MB;"');

    executeLinuxCommand('sync; echo 3 > /proc/sys/vm/drop_caches');

    executeLinuxCommand('redis-cli config set maxmemory 2gb');
    executeLinuxCommand('redis-cli config set maxmemory-policy allkeys-lru');

    executeLinuxCommand('echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor');
}

async function setupMongoCollections() {
    try {
        logger.info('Setting up MongoDB collections');
        await mongoClient.connect();
        logger.debug('MongoDB connection established');

        const db = mongoClient.db();

        for (const collection of schemaConfig.mongoCollections) {
            try {
                await db.createCollection(collection.name);
                logger.info(`Created MongoDB collection: ${collection.name}`, {
                    collectionName: collection.name,
                });

                if (collection.indexes) {
                    for (const index of collection.indexes) {
                        await db.collection(collection.name).createIndex(index.key);
                        logger.debug(`Created index for collection ${collection.name}`, {
                            collectionName: collection.name,
                            index: index.key,
                        });
                    }
                }
            } catch (error) {
                if (error.code === 48) {
                    logger.debug(`Collection already exists: ${collection.name}`);
                    continue;
                }
                logger.error(`Failed to create MongoDB collection: ${collection.name}`, {
                    error: error.message,
                    stack: error.stack,
                    collectionName: collection.name,
                });
                throw error;
            }
        }

        logger.info('MongoDB collections setup completed successfully');
    } catch (error) {
        logger.error('MongoDB collections setup failed', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT_FIELD = 'created_at';
const DEFAULT_SORT_ORDER = 'DESC';

async function searchProducts(searchParams) {
    const {
        page = 1,
        pageSize = DEFAULT_PAGE_SIZE,
        sortField = DEFAULT_SORT_FIELD,
        sortOrder = DEFAULT_SORT_ORDER,
        name,
        category_id,
        min_price,
        max_price,
        tags,
        attributes,
    } = searchParams;

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

function createCategory(categoryData) {
    const { name, parent_id } = categoryData;
    const query = `
        INSERT INTO categories (name, parent_id)
        VALUES ($1, $2)
        RETURNING *
    `;
    return pgPool.query(query, [name, parent_id]);
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

function getProductComments(product_id) {
    return pgPool.query('SELECT * FROM product_comments WHERE product_id = $1 ORDER BY created_at DESC', [product_id]);
}

function addTagToProduct(product_id, tag_name) {
    const query = `
        INSERT INTO product_tags (product_id, tag_name)
        VALUES ($1, $2)
        RETURNING *
    `;
    return pgPool.query(query, [product_id, tag_name]);
}

function getProductsByTag(tag_name) {
    const query = `
        SELECT p.* 
        FROM products p
        JOIN product_tags pt ON p.id = pt.product_id
        WHERE pt.tag_name = $1
    `;
    return pgPool.query(query, [tag_name]);
}

async function storeProductDocument(productData) {
    const db = mongoClient.db();
    const collection = db.collection('product_documents');

    const document = {
        product_id: productData.id,
        name: productData.name,
        description: productData.description,
        category_id: productData.category_id,
        metadata: productData.metadata,
        created_at: new Date(),
        updated_at: new Date(),
    };

    return collection.insertOne(document);
}

async function searchProductDocuments(searchQuery) {
    const db = mongoClient.db();
    const collection = db.collection('product_documents');

    const query = {
        $text: {
            $search: searchQuery,
        },
    };

    return collection.find(query).toArray();
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

function getProductChats(user_id) {
    const query = `
        SELECT pc.*, p.name as product_name, 
               (SELECT message FROM chat_messages 
                WHERE chat_id = pc.id 
                ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM chat_messages 
                WHERE chat_id = pc.id 
                ORDER BY created_at DESC LIMIT 1) as last_message_time
        FROM product_chats pc
        JOIN products p ON pc.product_id = p.id
        WHERE pc.user_id = $1 OR pc.seller_id = $1
        ORDER BY pc.updated_at DESC
    `;
    return pgPool.query(query, [user_id]);
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

function getChatMessages(chat_id) {
    const query = `
        SELECT * FROM chat_messages 
        WHERE chat_id = $1 
        ORDER BY created_at ASC
    `;
    return pgPool.query(query, [chat_id]);
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

class SimpleNeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.weights1 = Array(inputSize)
            .fill()
            .map(() =>
                Array(hiddenSize)
                    .fill()
                    .map(() => Math.random() * 2 - 1)
            );
        this.weights2 = Array(hiddenSize)
            .fill()
            .map(() =>
                Array(outputSize)
                    .fill()
                    .map(() => Math.random() * 2 - 1)
            );
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    sigmoidDerivative(x) {
        return x * (1 - x);
    }

    forward(input) {
        this.hidden = input.map(x => this.sigmoid(this.weights1.reduce((sum, w, i) => sum + w * x[i], 0)));
        return this.hidden.map(h => this.sigmoid(this.weights2.reduce((sum, w, i) => sum + w * h[i], 0)));
    }

    train(input, target, learningRate = 0.1) {
        const output = this.forward(input);
        const outputError = target.map((t, i) => t - output[i]);
        const outputDelta = outputError.map((e, i) => e * this.sigmoidDerivative(output[i]));

        const hiddenError = this.weights2.map(w => w.reduce((sum, weight, i) => sum + weight * outputDelta[i], 0));
        const hiddenDelta = hiddenError.map((e, i) => e * this.sigmoidDerivative(this.hidden[i]));

        for (let i = 0; i < this.weights1.length; i++) {
            for (let j = 0; j < this.weights1[i].length; j++) {
                this.weights1[i][j] += learningRate * input[i] * hiddenDelta[j];
            }
        }

        for (let i = 0; i < this.weights2.length; i++) {
            for (let j = 0; j < this.weights2[i].length; j++) {
                this.weights2[i][j] += learningRate * this.hidden[i] * outputDelta[j];
            }
        }
    }
}

async function trainRecommendationModel() {
    try {
        const result = await pgPool.query(`
            SELECT 
                p.id as product_id,
                p.category_id,
                COUNT(DISTINCT pc.user_id) as view_count,
                COUNT(DISTINCT pt.tag_name) as tag_count,
                AVG(p.price) as avg_price
            FROM products p
            LEFT JOIN product_comments pc ON p.id = pc.product_id
            LEFT JOIN product_tags pt ON p.id = pt.product_id
            GROUP BY p.id, p.category_id
        `);

        const trainingData = result.rows.map(row => ({
            input: [row.category_id / 100, row.view_count / 1000, row.tag_count / 10, row.avg_price / 1000],
            output: [row.view_count > 10 ? 1 : 0],
        }));

        const nn = new SimpleNeuralNetwork(4, 8, 1);
        for (let i = 0; i < 1000; i++) {
            trainingData.forEach(data => {
                nn.train(data.input, data.output);
            });
        }

        return nn;
    } catch (error) {
        console.error('Error training recommendation model:', error);
        throw error;
    }
}

async function getProductRecommendations(productId) {
    try {
        const product = await getProductById(productId);
        if (!product.rows.length) {
            throw new Error('Product not found');
        }

        const model = await trainRecommendationModel();

        const result = await pgPool.query(
            `
            SELECT 
                p.*,
                COUNT(DISTINCT pt.tag_name) as tag_count,
                COUNT(DISTINCT pc.user_id) as view_count
            FROM products p
            LEFT JOIN product_tags pt ON p.id = pt.product_id
            LEFT JOIN product_comments pc ON p.id = pc.product_id
            WHERE p.id != $1
            GROUP BY p.id
            HAVING COUNT(DISTINCT pt.tag_name) > 0
            ORDER BY 
                CASE WHEN p.category_id = $2 THEN 1 ELSE 0 END DESC,
                tag_count DESC,
                view_count DESC
            LIMIT 10
        `,
            [productId, product.rows[0].category_id]
        );

        const scoredProducts = result.rows.map(row => {
            const input = [row.category_id / 100, row.view_count / 1000, row.tag_count / 10, row.price / 1000];
            const score = model.forward(input)[0];
            return { ...row, score };
        });

        return scoredProducts.sort((a, b) => b.score - a.score);
    } catch (error) {
        console.error('Error getting product recommendations:', error);
        throw error;
    }
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
    return pgPool.query(query, [
        product_id,
        variant_id,
        price,
        change_reason,
        effective_date || new Date(),
        discount_percentage || 0,
        currency || 'USD',
        source || 'system',
    ]);
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

function getWishlist(user_id) {
    return pgPool.query('SELECT p.* FROM products p JOIN wishlist pw ON p.id = pw.product_id WHERE pw.user_id = $1', [user_id]);
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

class EnhancedNeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.weights1 = Array(inputSize)
            .fill()
            .map(() =>
                Array(hiddenSize)
                    .fill()
                    .map(() => Math.random() * 2 - 1)
            );
        this.weights2 = Array(hiddenSize)
            .fill()
            .map(() =>
                Array(outputSize)
                    .fill()
                    .map(() => Math.random() * 2 - 1)
            );
        this.bias1 = Array(hiddenSize)
            .fill()
            .map(() => Math.random() * 2 - 1);
        this.bias2 = Array(outputSize)
            .fill()
            .map(() => Math.random() * 2 - 1);
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    sigmoidDerivative(x) {
        return x * (1 - x);
    }

    forward(input) {
        this.hidden = input.map(x => this.sigmoid(this.weights1.reduce((sum, w, i) => sum + w * x[i], 0) + this.bias1));
        return this.hidden.map(h => this.sigmoid(this.weights2.reduce((sum, w, i) => sum + w * h[i], 0) + this.bias2));
    }

    train(input, target, learningRate = 0.1) {
        const output = this.forward(input);
        const outputError = target.map((t, i) => t - output[i]);
        const outputDelta = outputError.map((e, i) => e * this.sigmoidDerivative(output[i]));

        const hiddenError = this.weights2.map(w => w.reduce((sum, weight, i) => sum + weight * outputDelta[i], 0));
        const hiddenDelta = hiddenError.map((e, i) => e * this.sigmoidDerivative(this.hidden[i]));

        for (let i = 0; i < this.weights1.length; i++) {
            for (let j = 0; j < this.weights1[i].length; j++) {
                this.weights1[i][j] += learningRate * input[i] * hiddenDelta[j];
            }
        }

        for (let i = 0; i < this.weights2.length; i++) {
            for (let j = 0; j < this.weights2[i].length; j++) {
                this.weights2[i][j] += learningRate * this.hidden[i] * outputDelta[j];
            }
        }

        this.bias1 = this.bias1.map((b, i) => b + learningRate * hiddenDelta[i]);
        this.bias2 = this.bias2.map((b, i) => b + learningRate * outputDelta[i]);
    }
}

const BULK_OPERATION_TYPES = {
    UPDATE: 'update',
    INSERT: 'insert',
    DELETE: 'delete',
    PRICE_UPDATE: 'price_update',
    INVENTORY_UPDATE: 'inventory_update',
    ATTRIBUTE_UPDATE: 'attribute_update',
};

async function processBulkOperation(type, data, options = {}) {
    const { batchSize = BATCH_SIZE, concurrency = MAX_CONCURRENT_JOBS, retryAttempts = 3, retryDelay = 1000 } = options;

    logger.info('Starting bulk operation', {
        type,
        dataLength: data.length,
        batchSize,
        concurrency,
        retryAttempts,
    });

    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
    }

    logger.debug('Data split into batches', {
        type,
        batchCount: batches.length,
        batchSize,
    });

    const results = [];
    const activeJobs = new Set();

    for (const batch of batches) {
        while (activeJobs.size >= concurrency) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const jobId = Date.now().toString();
        activeJobs.add(jobId);

        try {
            logger.debug('Adding job to queue', {
                type,
                jobId,
                batchSize: batch.length,
            });

            const result = await bulkOperationQueue.add(
                type,
                {
                    batch,
                    options: {
                        retryAttempts,
                        retryDelay,
                    },
                },
                {
                    attempts: retryAttempts,
                    backoff: {
                        type: 'exponential',
                        delay: retryDelay,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                }
            );

            results.push(result);
            logger.debug('Job added successfully', {
                type,
                jobId,
                result,
            });
        } catch (error) {
            logger.error('Failed to add job to queue', {
                error: error.message,
                stack: error.stack,
                type,
                jobId,
            });
            throw error;
        } finally {
            activeJobs.delete(jobId);
        }
    }

    logger.info('Bulk operation completed', {
        type,
        totalJobs: results.length,
        successCount: results.filter(r => r.status === 'completed').length,
    });

    return results;
}

bulkOperationQueue.process(BULK_OPERATION_TYPES.UPDATE, async job => {
    const { batch, options } = job.data;
    const client = await pgPool.connect();

    try {
        await client.query('BEGIN');

        for (const product of batch) {
            await client.query(
                `UPDATE products 
                 SET name = $1, description = $2, price = $3, 
                     category_id = $4, metadata = $5, updated_at = NOW()
                 WHERE id = $6`,
                [product.name, product.description, product.price, product.category_id, product.metadata, product.id]
            );
        }

        await client.query('COMMIT');
        await invalidateCachePattern(`${CACHE_PREFIXES.PRODUCT}*`);

        return { success: true, count: batch.length };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

bulkOperationQueue.process(BULK_OPERATION_TYPES.PRICE_UPDATE, async job => {
    const { batch, options } = job.data;
    const client = await pgPool.connect();

    try {
        await client.query('BEGIN');

        for (const update of batch) {
            await client.query(
                `UPDATE products 
                 SET price = $1, updated_at = NOW()
                 WHERE id = $2`,
                [update.price, update.product_id]
            );

            await client.query(
                `INSERT INTO price_history 
                 (product_id, variant_id, price, change_type, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [update.product_id, update.variant_id, update.price, update.change_type]
            );
        }

        await client.query('COMMIT');
        await invalidateCachePattern(`${CACHE_PREFIXES.PRODUCT}*`);

        return { success: true, count: batch.length };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

bulkOperationQueue.process(BULK_OPERATION_TYPES.INVENTORY_UPDATE, async job => {
    const { batch, options } = job.data;
    const client = await pgPool.connect();

    try {
        await client.query('BEGIN');

        for (const update of batch) {
            await client.query(
                `INSERT INTO inventory_updates 
                 (product_id, variant_id, quantity_change, location, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (product_id, variant_id, location) 
                 DO UPDATE SET 
                    quantity = inventory_updates.quantity + $3,
                    updated_at = NOW()`,
                [update.product_id, update.variant_id, update.quantity_change, update.location]
            );
        }

        await client.query('COMMIT');
        await invalidateCachePattern(`${CACHE_PREFIXES.PRODUCT}*`);

        return { success: true, count: batch.length };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

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

// ======================================================================
async function main() {
    await clearCorruptedCache();
    init();
}
main();
// ======================================================================

function free() {
    console.log('\nCore free...');

    try {
        clearCorruptedCache();
    } catch (_) {
    } finally {
        console.log('Cache cleared');
    }

    setTimeout(() => {
        process.exit(0);
    }, 2 * 1000);
}

process.on('beforeExit', free);
process.on('SIGINT', free);
process.on('SIGTERM', free);
process.on('SIGQUIT', free);

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
