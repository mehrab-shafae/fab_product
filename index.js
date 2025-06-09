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
/*import { Client } from '@elastic/elasticsearch';*/
// ======================================================================
const PORT = process.env.PORT || 3000;
const POSTGRES_URI = process.env.POSTGRES_URI || 'postgresql://postgres:postgres@localhost:5432/product_db';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/product_db';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
/*
const ELASTICSEARCH_URI = process.env.ELASTICSEARCH_URI || 'https://localhost:9200';

const elasticClient = new Client({
    node: ELASTICSEARCH_URI,
    tls: {
        rejectUnauthorized: false
    }
});
*/

let redisClient = null;
let redisConnected = false;
let redisRetryCount = 0;
const MAX_REDIS_RETRIES = 5;
const REDIS_RETRY_DELAY = 5000;

async function initializeRedis() {
    try {
        redisClient = createClient({
            url: REDIS_URI,
            retry_strategy: function (options) {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    console.error('Redis connection refused. Retrying...');
                    return Math.min(options.attempt * REDIS_RETRY_DELAY, 30000);
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Redis retry time exhausted');
                }
                if (options.attempt > MAX_REDIS_RETRIES) {
                    return new Error('Redis max retries reached');
                }
                return Math.min(options.attempt * REDIS_RETRY_DELAY, 30000);
            },
        });

        redisClient.on('error', function (err) {
            console.error('Redis Client Error:', err);
            redisConnected = false;
            redisRetryCount++;

            if (redisRetryCount <= MAX_REDIS_RETRIES) {
                console.log(`Attempting to reconnect to Redis (${redisRetryCount}/${MAX_REDIS_RETRIES})...`);
                setTimeout(initializeRedis, REDIS_RETRY_DELAY);
            } else {
                console.error('Redis connection failed after maximum retries. Service will continue without Redis.');
            }
        });

        redisClient.on('connect', function () {
            console.log('Redis connected successfully');
            redisConnected = true;
            redisRetryCount = 0;
        });

        redisClient.on('reconnecting', function () {
            console.log('Redis reconnecting...');
            redisConnected = false;
        });

        await redisClient.connect();
    } catch (error) {
        console.error('Redis initialization error:', error);
        redisConnected = false;
    }
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

/*
const ELASTIC_INDEX = 'products';

async function setupElasticsearch() {
    try {
        
        const indexExists = await elasticClient.indices.exists({
            index: ELASTIC_INDEX
        });

        if (!indexExists) {
            
            await elasticClient.indices.create({
                index: ELASTIC_INDEX,
                body: {
                    mappings: {
                        properties: {
                            id: { type: 'integer' },
                            name: {
                                type: 'text',
                                fields: {
                                    keyword: { type: 'keyword' }
                                }
                            },
                            description: { type: 'text' },
                            price: { type: 'float' },
                            category_id: { type: 'integer' },
                            category_name: { type: 'keyword' },
                            tags: { type: 'keyword' },
                            metadata: { type: 'object' },
                            created_at: { type: 'date' },
                            updated_at: { type: 'date' }
                        }
                    },
                    settings: {
                        analysis: {
                            analyzer: {
                                custom_analyzer: {
                                    type: 'custom',
                                    tokenizer: 'standard',
                                    filter: ['lowercase', 'asciifolding']
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Elasticsearch setup error:', error);
        throw error;
    }
}


async function indexProduct(product) {
    try {
        
        let category_name = null;
        if (product.category_id) {
            const categoryResult = await pgPool.query(
                'SELECT name FROM categories WHERE id = $1',
                [product.category_id]
            );
            if (categoryResult.rows.length > 0) {
                category_name = categoryResult.rows[0].name;
            }
        }

        
        const tagsResult = await pgPool.query(
            'SELECT tag_name FROM product_tags WHERE product_id = $1',
            [product.id]
        );
        const tags = tagsResult.rows.map(row => row.tag_name);

        
        await elasticClient.index({
            index: ELASTIC_INDEX,
            id: product.id.toString(),
            body: {
                ...product,
                category_name,
                tags,
                updated_at: new Date()
            }
        });
    } catch (error) {
        console.error('Elasticsearch indexing error:', error);
        throw error;
    }
}


async function advancedSearch(searchParams) {
    try {
        const {
            query,
            category_id,
            min_price,
            max_price,
            tags,
            sort_by,
            sort_order = 'desc',
            page = 1,
            size = 10
        } = searchParams;

        const must = [];
        const filter = [];

        
        if (query) {
            must.push({
                multi_match: {
                    query,
                    fields: ['name^3', 'description^2', 'category_name'],
                    fuzziness: 'AUTO'
                }
            });
        }

        
        if (category_id) {
            filter.push({ term: { category_id } });
        }

        
        if (min_price || max_price) {
            const range = {};
            if (min_price) range.gte = min_price;
            if (max_price) range.lte = max_price;
            filter.push({ range: { price: range } });
        }

        
        if (tags && tags.length > 0) {
            filter.push({ terms: { tags } });
        }

        
        const sort = [];
        if (sort_by) {
            sort.push({ [sort_by]: { order: sort_order } });
        }
        sort.push({ _score: { order: 'desc' } });

        const response = await elasticClient.search({
            index: ELASTIC_INDEX,
            body: {
                query: {
                    bool: {
                        must,
                        filter
                    }
                },
                sort,
                from: (page - 1) * size,
                size
            }
        });

        return {
            total: response.hits.total.value,
            hits: response.hits.hits.map(hit => hit._source),
            page,
            size
        };
    } catch (error) {
        console.error('Elasticsearch search error:', error);
        throw error;
    }
}
*/

const CACHE_PREFIXES = {
    PRODUCT: 'product:',
    CATEGORY: 'category:',
    TAG: 'tag:',
    COMMENT: 'comment:',
    CHAT: 'chat:',
    ANALYTICS: 'analytics:',
};

const CACHE_TTL = {
    PRODUCT: 300,
    CATEGORY: 600,
    TAG: 300,
    COMMENT: 300,
    CHAT: 300,
    ANALYTICS: 600,
};

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Product Microservice API',
            version: '1.0.0',
            description: 'A comprehensive product management microservice with category, tag, and comment support',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Development server',
            },
        ],
        components: {
            schemas: {
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number', format: 'float' },
                        category_id: { type: 'integer' },
                        metadata: { type: 'object' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                    },
                },
                Category: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        parent_id: { type: 'integer', nullable: true },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Comment: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        product_id: { type: 'integer' },
                        user_id: { type: 'integer' },
                        comment: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Tag: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        product_id: { type: 'integer' },
                        tag_name: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
    },
    apis: ['./index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

const pgPool = new Pool({
    connectionString: POSTGRES_URI,
});

const mongoClient = new MongoClient(MONGO_URI);
// ======================================================================
function main() {
    init();
}
main();
// ======================================================================

function enhancedCacheMiddleware(prefix, ttl) {
    return function (req, res, next) {
        if (req.method !== 'GET' || !redisConnected) {
            return next();
        }

        const key = `${prefix}${req.originalUrl}`;
        redisClient
            .get(key)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return res.json(JSON.parse(cachedResponse));
                }

                res.sendResponse = res.json;
                res.json = function (body) {
                    if (redisConnected) {
                        redisClient.setEx(key, ttl, JSON.stringify(body)).catch(error => console.error('Cache error:', error));
                    }
                    res.sendResponse(body);
                };
                next();
            })
            .catch(error => {
                console.error('Cache error:', error);
                next();
            });
    };
}

async function getCachedData(key, fetchData, ttl) {
    try {
        if (!redisConnected) {
            return await fetchData();
        }

        const cachedData = await redisClient.get(key);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const data = await fetchData();
        if (redisConnected) {
            await redisClient.setEx(key, ttl, JSON.stringify(data));
        }
        return data;
    } catch (error) {
        console.error('Cache error:', error);
        return fetchData();
    }
}

async function invalidateCachePattern(pattern) {
    try {
        if (!redisConnected) {
            return;
        }

        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error);
    }
}

async function warmCache() {
    try {
        if (!redisConnected) {
            console.log('Skipping cache warming - Redis not connected');
            return;
        }

        const products = await pgPool.query('SELECT id FROM products ORDER BY created_at DESC LIMIT 100');
        for (const product of products.rows) {
            const key = `${CACHE_PREFIXES.PRODUCT}${product.id}`;
            const data = await getProductById(product.id);
            if (redisConnected) {
                await redisClient.setEx(key, CACHE_TTL.PRODUCT, JSON.stringify(data.rows[0]));
            }
        }

        const categories = await pgPool.query('SELECT id FROM categories');
        for (const category of categories.rows) {
            const key = `${CACHE_PREFIXES.CATEGORY}${category.id}`;
            const data = await getCategoryTree();
            if (redisConnected) {
                await redisClient.setEx(key, CACHE_TTL.CATEGORY, JSON.stringify(data.rows));
            }
        }

        const analytics = await pgPool.query('SELECT id FROM products ORDER BY created_at DESC LIMIT 50');
        for (const product of analytics.rows) {
            const key = `${CACHE_PREFIXES.ANALYTICS}${product.id}`;
            const data = await getProductAnalytics(product.id);
            if (redisConnected) {
                await redisClient.setEx(key, CACHE_TTL.ANALYTICS, JSON.stringify(data.rows[0]));
            }
        }

        console.log('Cache warming completed successfully');
    } catch (error) {
        console.error('Cache warming error:', error);
    }
}

function scheduleCacheWarming() {
    setInterval(warmCache, 4 * 60 * 60 * 1000);
}

async function init() {
    const app = express();

    await initializeRedis();

    app.use(cors());
    app.use(express.json());
    app.use(limiter);
    app.use(speedLimiter);

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

    createDatabaseSchema()
        .then(() => setupMongoCollections())
        /* .then(() => optimizeSystemForService()) */
        .then(() => scheduleMaterializedViewRefresh())
        .then(() => scheduleCacheWarming())
        .then(() => warmCache())
        .catch(error => {
            console.error('Initialization failed:', error);
            process.exit(1);
        });

    /**
     * @swagger
     * /products:
     *   post:
     *     summary: Create a new product
     *     tags: [Products]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - price
     *             properties:
     *               name:
     *                 type: string
     *               description:
     *                 type: string
     *               price:
     *                 type: number
     *               category_id:
     *                 type: integer
     *               metadata:
     *                 type: object
     *     responses:
     *       200:
     *         description: Product created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Product'
     *       500:
     *         description: Server error
     */
    app.post('/products', async function (req, res) {
        try {
            const result = await createProduct(req.body);
            const product = result.rows[0];
            await storeProductDocument(product);
            /*await indexProduct(product);*/

            await invalidateCachePattern('/products*');
            await invalidateCachePattern(`/products/${product.id}`);

            res.json(product);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /products/{id}:
     *   get:
     *     summary: Get a product by ID
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Product found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Product'
     *       404:
     *         description: Product not found
     *       500:
     *         description: Server error
     */
    app.get('/products/:id', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductById(req.params.id)
            .then(result => {
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                res.json(result.rows[0]);
            })
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products:
     *   get:
     *     summary: Search products
     *     tags: [Products]
     *     parameters:
     *       - in: query
     *         name: name
     *         schema:
     *           type: string
     *       - in: query
     *         name: category_id
     *         schema:
     *           type: integer
     *       - in: query
     *         name: min_price
     *         schema:
     *           type: number
     *       - in: query
     *         name: max_price
     *         schema:
     *           type: number
     *     responses:
     *       200:
     *         description: List of products
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Product'
     *       500:
     *         description: Server error
     */
    app.get('/products', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        searchProducts(req.query)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /categories:
     *   post:
     *     summary: Create a new category
     *     tags: [Categories]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *               parent_id:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Category created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Category'
     *       500:
     *         description: Server error
     */
    app.post('/categories', async function (req, res) {
        try {
            const result = await createCategory(req.body);
            await invalidateCachePattern('/categories*');
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /categories/tree:
     *   get:
     *     summary: Get category hierarchy
     *     tags: [Categories]
     *     responses:
     *       200:
     *         description: Category tree
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Category'
     *       500:
     *         description: Server error
     */
    app.get('/categories/tree', enhancedCacheMiddleware(CACHE_PREFIXES.CATEGORY, CACHE_TTL.CATEGORY), function (req, res) {
        getCategoryTree()
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/comments:
     *   post:
     *     summary: Add a comment to a product
     *     tags: [Comments]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - user_id
     *               - comment
     *             properties:
     *               user_id:
     *                 type: integer
     *               comment:
     *                 type: string
     *     responses:
     *       200:
     *         description: Comment added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Comment'
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/{productId}/comments:
     *   get:
     *     summary: Get comments for a product
     *     tags: [Comments]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of comments
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Comment'
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/comments', enhancedCacheMiddleware(CACHE_PREFIXES.COMMENT, CACHE_TTL.COMMENT), function (req, res) {
        getProductComments(req.params.productId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/tags:
     *   post:
     *     summary: Add a tag to a product
     *     tags: [Tags]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - tag_name
     *             properties:
     *               tag_name:
     *                 type: string
     *     responses:
     *       200:
     *         description: Tag added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Tag'
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/tags/{tagName}:
     *   get:
     *     summary: Get products by tag
     *     tags: [Tags]
     *     parameters:
     *       - in: path
     *         name: tagName
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of products with the specified tag
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Product'
     *       500:
     *         description: Server error
     */
    app.get('/products/tags/:tagName', enhancedCacheMiddleware(CACHE_PREFIXES.TAG, CACHE_TTL.TAG), function (req, res) {
        getProductsByTag(req.params.tagName)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/search/document:
     *   get:
     *     summary: Search products using full-text search
     *     tags: [Search]
     *     parameters:
     *       - in: query
     *         name: q
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Search results
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   product_id:
     *                     type: integer
     *                   name:
     *                     type: string
     *                   description:
     *                     type: string
     *       400:
     *         description: Search query is required
     *       500:
     *         description: Server error
     */
    app.get('/products/search/document', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
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
    });

    /**
     * @swagger
     * /products/search/advanced:
     *   get:
     *     summary: Advanced product search using Elasticsearch
     *     tags: [Search]
     *     parameters:
     *       - in: query
     *         name: query
     *         schema:
     *           type: string
     *       - in: query
     *         name: category_id
     *         schema:
     *           type: integer
     *       - in: query
     *         name: min_price
     *         schema:
     *           type: number
     *       - in: query
     *         name: max_price
     *         schema:
     *           type: number
     *       - in: query
     *         name: tags
     *         schema:
     *           type: array
     *           items:
     *             type: string
     *       - in: query
     *         name: sort_by
     *         schema:
     *           type: string
     *       - in: query
     *         name: sort_order
     *         schema:
     *           type: string
     *           enum: [asc, desc]
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *       - in: query
     *         name: size
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Search results
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 total:
     *                   type: integer
     *                 hits:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Product'
     *                 page:
     *                   type: integer
     *                 size:
     *                   type: integer
     *       500:
     *         description: Server error
     */
    /*
  app.get('/products/search/advanced', cacheMiddleware(300), async function(req, res) {
      try {
          const results = await advancedSearch(req.query);
          res.json(results);
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  });
  */

    /**
     * @swagger
     * /products/{productId}/chats:
     *   post:
     *     summary: Start a new chat for a product
     *     tags: [Chats]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - user_id
     *               - seller_id
     *             properties:
     *               user_id:
     *                 type: integer
     *               seller_id:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Chat created successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /users/{userId}/chats:
     *   get:
     *     summary: Get all chats for a user
     *     tags: [Chats]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of chats
     *       500:
     *         description: Server error
     */
    app.get('/users/:userId/chats', enhancedCacheMiddleware(CACHE_PREFIXES.CHAT, CACHE_TTL.CHAT), function (req, res) {
        getProductChats(req.params.userId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /chats/{chatId}/messages:
     *   post:
     *     summary: Add a message to a chat
     *     tags: [Chats]
     *     parameters:
     *       - in: path
     *         name: chatId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - sender_id
     *               - message
     *             properties:
     *               sender_id:
     *                 type: integer
     *               message:
     *                 type: string
     *     responses:
     *       200:
     *         description: Message added successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /chats/{chatId}/messages:
     *   get:
     *     summary: Get all messages in a chat
     *     tags: [Chats]
     *     parameters:
     *       - in: path
     *         name: chatId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of messages
     *       500:
     *         description: Server error
     */
    app.get('/chats/:chatId/messages', enhancedCacheMiddleware(CACHE_PREFIXES.CHAT, CACHE_TTL.CHAT), function (req, res) {
        getChatMessages(req.params.chatId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /chats/{chatId}/read:
     *   post:
     *     summary: Mark all messages in a chat as read
     *     tags: [Chats]
     *     parameters:
     *       - in: path
     *         name: chatId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - user_id
     *             properties:
     *               user_id:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Messages marked as read
     *       500:
     *         description: Server error
     */
    app.post('/chats/:chatId/read', async function (req, res) {
        try {
            const result = await markChatMessagesAsRead(req.params.chatId, req.body.user_id);
            await invalidateCachePattern(`/chats/${req.params.chatId}/messages`);
            res.json(result.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /products/{productId}/analytics:
     *   get:
     *     summary: Get detailed analytics for a product
     *     tags: [Analytics]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Product analytics data
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id:
     *                   type: integer
     *                 name:
     *                   type: string
     *                 unique_viewers:
     *                   type: integer
     *                 tag_count:
     *                   type: integer
     *                 comment_count:
     *                   type: integer
     *                 chat_count:
     *                   type: integer
     *                 avg_price:
     *                   type: number
     *                 min_price:
     *                   type: number
     *                 max_price:
     *                   type: number
     *                 category_name:
     *                   type: string
     *                 tag_analytics:
     *                   type: array
     *                   items:
     *                     type: object
     *                 recent_comments:
     *                   type: array
     *                   items:
     *                     type: object
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/analytics', enhancedCacheMiddleware(CACHE_PREFIXES.ANALYTICS, CACHE_TTL.ANALYTICS), function (req, res) {
        getProductAnalytics(req.params.productId)
            .then(result => {
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                res.json(result.rows[0]);
            })
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /categories/{categoryId}/analytics:
     *   get:
     *     summary: Get detailed analytics for a category and its subcategories
     *     tags: [Analytics]
     *     parameters:
     *       - in: path
     *         name: categoryId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Category analytics data
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: integer
     *                   name:
     *                     type: string
     *                   level:
     *                     type: integer
     *                   product_count:
     *                     type: integer
     *                   total_viewers:
     *                     type: integer
     *                   total_tags:
     *                     type: integer
     *                   avg_price:
     *                     type: number
     *                   min_price:
     *                     type: number
     *                   max_price:
     *                     type: number
     *                   subcategories:
     *                     type: array
     *                     items:
     *                       type: object
     *       500:
     *         description: Server error
     */
    app.get('/categories/:categoryId/analytics', enhancedCacheMiddleware(CACHE_PREFIXES.ANALYTICS, CACHE_TTL.ANALYTICS), function (req, res) {
        getCategoryAnalytics(req.params.categoryId)
            .then(result => {
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Category not found' });
                }
                res.json(result.rows);
            })
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/recommendations:
     *   get:
     *     summary: Get product recommendations
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of recommended products
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Product'
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/recommendations', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductRecommendations(req.params.productId)
            .then(result => res.json(result))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/variants:
     *   post:
     *     summary: Create a new product variant
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - sku
     *               - name
     *               - price
     *             properties:
     *               sku:
     *                 type: string
     *               name:
     *                 type: string
     *               price:
     *                 type: number
     *               stock_quantity:
     *                 type: integer
     *               attributes:
     *                 type: object
     *     responses:
     *       200:
     *         description: Variant created successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/{productId}/variants:
     *   get:
     *     summary: Get all variants for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of product variants
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/variants', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductVariants(req.params.productId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/images:
     *   post:
     *     summary: Add an image to a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - image_url
     *             properties:
     *               image_url:
     *                 type: string
     *               variant_id:
     *                 type: integer
     *               is_primary:
     *                 type: boolean
     *               order_index:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Image added successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/{productId}/images:
     *   get:
     *     summary: Get all images for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of product images
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/images', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductImages(req.params.productId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/inventory:
     *   post:
     *     summary: Update product inventory
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - quantity
     *             properties:
     *               variant_id:
     *                 type: integer
     *               quantity:
     *                 type: integer
     *               reserved_quantity:
     *                 type: integer
     *               location:
     *                 type: string
     *     responses:
     *       200:
     *         description: Inventory updated successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/{productId}/reviews:
     *   post:
     *     summary: Add a review to a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - user_id
     *               - rating
     *             properties:
     *               user_id:
     *                 type: integer
     *               rating:
     *                 type: integer
     *                 minimum: 1
     *                 maximum: 5
     *               review_text:
     *                 type: string
     *               is_verified:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Review added successfully
     *       500:
     *         description: Server error
     */
    app.post('/products/:productId/reviews', async function (req, res) {
        try {
            const reviewData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addProductReview(reviewData);
            await invalidateCachePattern(`/products/${req.params.productId}/reviews`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /products/{productId}/reviews:
     *   get:
     *     summary: Get all reviews for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of product reviews
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/reviews', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductReviews(req.params.productId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /users/{userId}/wishlist:
     *   post:
     *     summary: Add a product to user's wishlist
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - product_id
     *             properties:
     *               product_id:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Product added to wishlist
     *       500:
     *         description: Server error
     */
    app.post('/users/:userId/wishlist', async function (req, res) {
        try {
            const wishlistData = {
                ...req.body,
                user_id: req.params.userId,
            };
            const result = await addToWishlist(wishlistData);
            await invalidateCachePattern(`/users/${req.params.userId}/wishlist`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /users/{userId}/wishlist:
     *   get:
     *     summary: Get user's wishlist
     *     tags: [Users]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of wishlist products
     *       500:
     *         description: Server error
     */
    app.get('/users/:userId/wishlist', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getWishlist(req.params.userId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /health:
     *   get:
     *     summary: Check system health
     *     tags: [System]
     *     responses:
     *       200:
     *         description: System health status
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                 services:
     *                   type: object
     *                   properties:
     *                     postgres:
     *                       type: string
     *                     redis:
     *                       type: string
     *                     mongo:
     *                       type: string
     */
    app.get('/health', function (req, res) {
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                postgres: pgPool ? 'connected' : 'disconnected',
                redis: {
                    status: redisConnected ? 'connected' : 'disconnected',
                    retryCount: redisRetryCount,
                    maxRetries: MAX_REDIS_RETRIES,
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

    /**
     * @swagger
     * /products/{productId}/attributes:
     *   post:
     *     summary: Add an attribute to a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - attribute_id
     *               - value
     *             properties:
     *               attribute_id:
     *                 type: integer
     *               value:
     *                 type: string
     *     responses:
     *       200:
     *         description: Attribute added successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /attributes:
     *   post:
     *     summary: Create a new product attribute
     *     tags: [Products]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - type
     *             properties:
     *               name:
     *                 type: string
     *               type:
     *                 type: string
     *     responses:
     *       200:
     *         description: Attribute created successfully
     *       500:
     *         description: Server error
     */
    app.post('/attributes', async function (req, res) {
        try {
            const result = await createProductAttribute(req.body);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /products/{productId}/attributes:
     *   get:
     *     summary: Get all attributes for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of product attributes
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/attributes', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductAttributes(req.params.productId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/price-history:
     *   get:
     *     summary: Get price history for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *       - in: query
     *         name: variant_id
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of price changes
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/price-history', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductPriceHistory(req.params.productId, req.query.variant_id)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/price-statistics:
     *   get:
     *     summary: Get price statistics for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *       - in: query
     *         name: variant_id
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Price statistics including min, max, average, and recent changes
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/price-statistics', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductPriceStatistics(req.params.productId, req.query.variant_id)
            .then(result => res.json(result.rows[0]))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/price-trends:
     *   get:
     *     summary: Get price trends for a product over time
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *       - in: query
     *         name: variant_id
     *         schema:
     *           type: integer
     *       - in: query
     *         name: period
     *         schema:
     *           type: string
     *           default: 30 days
     *           description: Time period for trends (e.g., '7 days', '30 days', '1 year')
     *     responses:
     *       200:
     *         description: Daily price trends including min, max, and average prices
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/price-trends', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductPriceTrends(req.params.productId, req.query.variant_id, req.query.period)
            .then(result => res.json(result.rows[0]))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/price-history:
     *   post:
     *     summary: Add a new price history entry
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - price
     *               - change_reason
     *             properties:
     *               variant_id:
     *                 type: integer
     *               price:
     *                 type: number
     *               change_reason:
     *                 type: string
     *               effective_date:
     *                 type: string
     *                 format: date-time
     *               discount_percentage:
     *                 type: number
     *               currency:
     *                 type: string
     *               source:
     *                 type: string
     *     responses:
     *       200:
     *         description: Price history entry added successfully
     *       500:
     *         description: Server error
     */
    app.post('/products/:productId/price-history', async function (req, res) {
        try {
            const priceData = {
                ...req.body,
                product_id: req.params.productId,
            };
            const result = await addPriceHistory(priceData);
            await invalidateCachePattern(`/products/${req.params.productId}/price-history`);
            await invalidateCachePattern(`/products/${req.params.productId}/price-statistics`);
            await invalidateCachePattern(`/products/${req.params.productId}/price-trends`);
            res.json(result.rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * @swagger
     * /products/{productId}/relationships:
     *   post:
     *     summary: Add a relationship between products
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - related_product_id
     *               - relationship_type
     *             properties:
     *               related_product_id:
     *                 type: integer
     *               relationship_type:
     *                 type: string
     *                 enum: [similar, complementary, upgrade, downgrade]
     *     responses:
     *       200:
     *         description: Relationship added successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/{productId}/relationships:
     *   get:
     *     summary: Get all relationships for a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *       - in: query
     *         name: relationship_type
     *         schema:
     *           type: string
     *           enum: [similar, complementary, upgrade, downgrade]
     *     responses:
     *       200:
     *         description: List of product relationships
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/relationships', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductRelationships(req.params.productId, req.query.relationship_type)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

    /**
     * @swagger
     * /products/{productId}/versions:
     *   post:
     *     summary: Create a new version of a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - version_number
     *               - changes
     *             properties:
     *               version_number:
     *                 type: integer
     *               changes:
     *                 type: object
     *               created_by:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Version created successfully
     *       500:
     *         description: Server error
     */
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

    /**
     * @swagger
     * /products/{productId}/versions:
     *   get:
     *     summary: Get version history of a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: productId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of product versions
     *       500:
     *         description: Server error
     */
    app.get('/products/:productId/versions', enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT), function (req, res) {
        getProductVersions(req.params.productId)
            .then(result => res.json(result.rows))
            .catch(error => res.status(500).json({ error: error.message }));
    });

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

    app.listen(PORT, function () {
        console.log(`Product service is running on port ${PORT}`);
        console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
    });
}

function createDatabaseSchema() {
    const createTablesQuery = `
        -- Install required extensions
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        
        -- Drop existing triggers if they exist
        -- TODO(Dmitrii): remove this after testing
        DROP TRIGGER IF EXISTS refresh_product_stats_trigger ON products;
        DROP TRIGGER IF EXISTS refresh_product_stats_comments_trigger ON product_comments;
        DROP TRIGGER IF EXISTS refresh_product_stats_tags_trigger ON product_tags;
        DROP TRIGGER IF EXISTS refresh_product_stats_chats_trigger ON product_chats;
        
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            parent_id INTEGER REFERENCES categories(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2),
            category_id INTEGER REFERENCES categories(id),
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS product_tags (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            tag_name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS product_comments (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            user_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS product_chats (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            user_id INTEGER NOT NULL,
            seller_id INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            chat_id INTEGER REFERENCES product_chats(id),
            sender_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
        CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
        CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops);
        
        CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_tags_tag_name ON product_tags(tag_name);
        
        CREATE INDEX IF NOT EXISTS idx_product_comments_product_id ON product_comments(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_comments_user_id ON product_comments(user_id);
        CREATE INDEX IF NOT EXISTS idx_product_comments_created_at ON product_comments(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_product_chats_product_id ON product_chats(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_chats_user_id ON product_chats(user_id);
        CREATE INDEX IF NOT EXISTS idx_product_chats_seller_id ON product_chats(seller_id);
        CREATE INDEX IF NOT EXISTS idx_product_chats_status ON product_chats(status);
        
        CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read);

        -- Create materialized views for frequently accessed data
        CREATE MATERIALIZED VIEW IF NOT EXISTS product_stats AS
        SELECT 
            p.id,
            p.name,
            p.category_id,
            COUNT(DISTINCT pc.user_id) as view_count,
            COUNT(DISTINCT pt.tag_name) as tag_count,
            COUNT(DISTINCT pcm.id) as comment_count,
            COUNT(DISTINCT pch.id) as chat_count,
            AVG(p.price) as avg_price
        FROM products p
        LEFT JOIN product_comments pc ON p.id = pc.product_id
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN product_comments pcm ON p.id = pcm.product_id
        LEFT JOIN product_chats pch ON p.id = pch.product_id
        GROUP BY p.id, p.name, p.category_id;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_stats_id ON product_stats(id);

        -- Create function to refresh materialized view
        CREATE OR REPLACE FUNCTION refresh_product_stats()
        RETURNS trigger AS $$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        -- Create triggers to refresh materialized view
        CREATE TRIGGER refresh_product_stats_trigger
        AFTER INSERT OR UPDATE OR DELETE ON products
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_product_stats();

        CREATE TRIGGER refresh_product_stats_comments_trigger
        AFTER INSERT OR UPDATE OR DELETE ON product_comments
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_product_stats();

        CREATE TRIGGER refresh_product_stats_tags_trigger
        AFTER INSERT OR UPDATE OR DELETE ON product_tags
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_product_stats();

        CREATE TRIGGER refresh_product_stats_chats_trigger
        AFTER INSERT OR UPDATE OR DELETE ON product_chats
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_product_stats();

        -- Product Variants
        CREATE TABLE IF NOT EXISTS product_variants (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            sku VARCHAR(100) UNIQUE,
            name VARCHAR(255),
            price DECIMAL(10,2),
            stock_quantity INTEGER DEFAULT 0,
            attributes JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Images
        CREATE TABLE IF NOT EXISTS product_images (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            variant_id INTEGER REFERENCES product_variants(id),
            image_url TEXT NOT NULL,
            is_primary BOOLEAN DEFAULT false,
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Inventory
        CREATE TABLE IF NOT EXISTS product_inventory (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            variant_id INTEGER REFERENCES product_variants(id),
            quantity INTEGER DEFAULT 0,
            reserved_quantity INTEGER DEFAULT 0,
            location VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(product_id, variant_id)
        );

        -- Product Price History
        -- TODO(Dmitrii): remove this after testing
        DROP TABLE IF EXISTS product_price_history;
        CREATE TABLE IF NOT EXISTS product_price_history (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
            variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
            price DECIMAL(10,2) NOT NULL,
            change_reason VARCHAR(255) NOT NULL,
            effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            discount_percentage DECIMAL(5,2) DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'USD',
            source VARCHAR(50) DEFAULT 'system',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id);
        CREATE INDEX IF NOT EXISTS idx_price_history_variant ON product_price_history(variant_id);
        CREATE INDEX IF NOT EXISTS idx_price_history_date ON product_price_history(effective_date);

        -- Product Attributes
        CREATE TABLE IF NOT EXISTS product_attributes (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Attribute Values
        CREATE TABLE IF NOT EXISTS product_attribute_values (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            attribute_id INTEGER REFERENCES product_attributes(id),
            value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Reviews
        CREATE TABLE IF NOT EXISTS product_reviews (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            user_id INTEGER NOT NULL,
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            review_text TEXT,
            is_verified BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Wishlist
        CREATE TABLE IF NOT EXISTS product_wishlist (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product_id INTEGER REFERENCES products(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Sharing
        CREATE TABLE IF NOT EXISTS product_shares (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            user_id INTEGER NOT NULL,
            share_type VARCHAR(50),
            share_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Versions
        CREATE TABLE IF NOT EXISTS product_versions (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            version_number INTEGER,
            changes JSONB,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Product Relationships
        CREATE TABLE IF NOT EXISTS product_relationships (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            related_product_id INTEGER REFERENCES products(id),
            relationship_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for new tables
        CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
        CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_price_history_product_id ON product_price_history(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_attribute_values_product_id ON product_attribute_values(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_wishlist_user_id ON product_wishlist(user_id);
        CREATE INDEX IF NOT EXISTS idx_product_shares_product_id ON product_shares(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_versions_product_id ON product_versions(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_relationships_product_id ON product_relationships(product_id);

        -- Create materialized views for new features
        CREATE MATERIALIZED VIEW IF NOT EXISTS product_variant_stats AS
        SELECT 
            pv.product_id,
            COUNT(DISTINCT pv.id) as variant_count,
            AVG(pv.price) as avg_variant_price,
            MIN(pv.price) as min_variant_price,
            MAX(pv.price) as max_variant_price,
            SUM(pi.quantity) as total_stock
        FROM product_variants pv
        LEFT JOIN product_inventory pi ON pv.id = pi.variant_id
        GROUP BY pv.product_id;

        CREATE MATERIALIZED VIEW IF NOT EXISTS product_review_stats AS
        SELECT 
            pr.product_id,
            COUNT(*) as review_count,
            AVG(pr.rating) as avg_rating,
            COUNT(CASE WHEN pr.rating >= 4 THEN 1 END) as positive_reviews
        FROM product_reviews pr
        GROUP BY pr.product_id;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variant_stats_product_id ON product_variant_stats(product_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_review_stats_product_id ON product_review_stats(product_id);
    `;

    return pgPool.query(createTablesQuery);
}

async function refreshMaterializedViews() {
    try {
        await pgPool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats');
        console.log('Materialized views refreshed successfully');
    } catch (error) {
        console.error('Error refreshing materialized views:', error);
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
    await mongoClient.connect();
    const db = mongoClient.db();

    await db.collection('product_documents').createIndex({
        name: 'text',
        description: 'text',
    });

    await db.collection('product_documents').createIndex({
        category_id: 1,
    });
}

function createProduct(productData) {
    const { name, description, price, category_id, metadata } = productData;
    const query = `
        INSERT INTO products (name, description, price, category_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    return pgPool.query(query, [name, description, price, category_id, metadata]);
}

function getProductById(id) {
    return pgPool.query('SELECT * FROM products WHERE id = $1', [id]);
}

function searchProducts(searchParams) {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (searchParams.name) {
        query += ` AND name ILIKE $${paramIndex}`;
        params.push(`%${searchParams.name}%`);
        paramIndex++;
    }

    if (searchParams.category_id) {
        query += ` AND category_id = $${paramIndex}`;
        params.push(searchParams.category_id);
        paramIndex++;
    }

    if (searchParams.min_price) {
        query += ` AND price >= $${paramIndex}`;
        params.push(searchParams.min_price);
        paramIndex++;
    }

    if (searchParams.max_price) {
        query += ` AND price <= $${paramIndex}`;
        params.push(searchParams.max_price);
        paramIndex++;
    }

    return pgPool.query(query, params);
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
        ON CONFLICT (product_id, variant_id) 
        DO UPDATE SET 
            quantity = EXCLUDED.quantity,
            reserved_quantity = EXCLUDED.reserved_quantity,
            location = EXCLUDED.location,
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
            ${variant_id ? 'AND variant_id = $2' : ''}
            AND effective_date >= NOW() - ${variant_id ? '$3' : '$2'}::interval
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

    const params = variant_id ? [product_id, variant_id, interval] : [product_id, interval];

    return pgPool.query(query, params);
}

function createProductAttribute(attributeData) {
    const { name, type } = attributeData;
    const query = `
        INSERT INTO product_attributes (name, type)
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

function getProductReviews(product_id) {
    return pgPool.query('SELECT * FROM product_reviews WHERE product_id = $1 ORDER BY created_at DESC', [product_id]);
}

function addToWishlist(wishlistData) {
    const { user_id, product_id } = wishlistData;
    const query = `
        INSERT INTO product_wishlist (user_id, product_id)
        VALUES ($1, $2)
        RETURNING *
    `;
    return pgPool.query(query, [user_id, product_id]);
}

function getWishlist(user_id) {
    return pgPool.query('SELECT p.* FROM products p JOIN product_wishlist pw ON p.id = pw.product_id WHERE pw.user_id = $1', [user_id]);
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
