import express from 'express';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { createClient } from 'redis';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
// import { Client } from '@elastic/elasticsearch';

// Load environment variables
dotenv.config();

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;
const POSTGRES_URI = process.env.POSTGRES_URI || 'postgresql://postgres:postgres@localhost:5432/product_db';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/product_db';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
// const ELASTICSEARCH_URI = process.env.ELASTICSEARCH_URI || 'https://localhost:9200';

// // Elasticsearch client setup
// const elasticClient = new Client({
//     node: ELASTICSEARCH_URI,
//     tls: {
//         rejectUnauthorized: false
//     }
// });

// Redis client setup
const redisClient = createClient({
    url: REDIS_URI
});

redisClient.on('error', function(err) {
    console.error('Redis Client Error:', err);
});

// Rate limiting configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Slow down configuration for potential DDoS attacks
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per 15 minutes, then...
    delayMs: (used, req) => {
        const delayAfter = req.slowDown.limit;
        return (used - delayAfter) * 500;
    }
});

// Elasticsearch index configuration
// const ELASTIC_INDEX = 'products';

// // Elasticsearch setup function
// async function setupElasticsearch() {
//     try {
//         // Check if index exists
//         const indexExists = await elasticClient.indices.exists({
//             index: ELASTIC_INDEX
//         });

//         if (!indexExists) {
//             // Create index with mappings
//             await elasticClient.indices.create({
//                 index: ELASTIC_INDEX,
//                 body: {
//                     mappings: {
//                         properties: {
//                             id: { type: 'integer' },
//                             name: { 
//                                 type: 'text',
//                                 fields: {
//                                     keyword: { type: 'keyword' }
//                                 }
//                             },
//                             description: { type: 'text' },
//                             price: { type: 'float' },
//                             category_id: { type: 'integer' },
//                             category_name: { type: 'keyword' },
//                             tags: { type: 'keyword' },
//                             metadata: { type: 'object' },
//                             created_at: { type: 'date' },
//                             updated_at: { type: 'date' }
//                         }
//                     },
//                     settings: {
//                         analysis: {
//                             analyzer: {
//                                 custom_analyzer: {
//                                     type: 'custom',
//                                     tokenizer: 'standard',
//                                     filter: ['lowercase', 'asciifolding']
//                                 }
//                             }
//                         }
//                     }
//                 }
//             });
//         }
//     } catch (error) {
//         console.error('Elasticsearch setup error:', error);
//         throw error;
//     }
// }

// Elasticsearch indexing function
// async function indexProduct(product) {
//     try {
//         // Get category name if category_id exists
//         let category_name = null;
//         if (product.category_id) {
//             const categoryResult = await pgPool.query(
//                 'SELECT name FROM categories WHERE id = $1',
//                 [product.category_id]
//             );
//             if (categoryResult.rows.length > 0) {
//                 category_name = categoryResult.rows[0].name;
//             }
//         }

//         // Get product tags
//         const tagsResult = await pgPool.query(
//             'SELECT tag_name FROM product_tags WHERE product_id = $1',
//             [product.id]
//         );
//         const tags = tagsResult.rows.map(row => row.tag_name);

//         // Index document
//         await elasticClient.index({
//             index: ELASTIC_INDEX,
//             id: product.id.toString(),
//             body: {
//                 ...product,
//                 category_name,
//                 tags,
//                 updated_at: new Date()
//             }
//         });
//     } catch (error) {
//         console.error('Elasticsearch indexing error:', error);
//         throw error;
//     }
// }

// // Advanced search function
// async function advancedSearch(searchParams) {
//     try {
//         const {
//             query,
//             category_id,
//             min_price,
//             max_price,
//             tags,
//             sort_by,
//             sort_order = 'desc',
//             page = 1,
//             size = 10
//         } = searchParams;

//         const must = [];
//         const filter = [];

//         // Text search
//         if (query) {
//             must.push({
//                 multi_match: {
//                     query,
//                     fields: ['name^3', 'description^2', 'category_name'],
//                     fuzziness: 'AUTO'
//                 }
//             });
//         }

//         // Category filter
//         if (category_id) {
//             filter.push({ term: { category_id } });
//         }

//         // Price range
//         if (min_price || max_price) {
//             const range = {};
//             if (min_price) range.gte = min_price;
//             if (max_price) range.lte = max_price;
//             filter.push({ range: { price: range } });
//         }

//         // Tags filter
//         if (tags && tags.length > 0) {
//             filter.push({ terms: { tags } });
//         }

//         // Build sort
//         const sort = [];
//         if (sort_by) {
//             sort.push({ [sort_by]: { order: sort_order } });
//         }
//         sort.push({ _score: { order: 'desc' } });

//         const response = await elasticClient.search({
//             index: ELASTIC_INDEX,
//             body: {
//                 query: {
//                     bool: {
//                         must,
//                         filter
//                     }
//                 },
//                 sort,
//                 from: (page - 1) * size,
//                 size
//             }
//         });

//         return {
//             total: response.hits.total.value,
//             hits: response.hits.hits.map(hit => hit._source),
//             page,
//             size
//         };
//     } catch (error) {
//         console.error('Elasticsearch search error:', error);
//         throw error;
//     }
// }

// Cache middleware
function cacheMiddleware(duration) {
    return function(req, res, next) {
        if (req.method !== 'GET') {
            return next();
        }

        const key = `cache:${req.originalUrl}`;
        redisClient.get(key)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return res.json(JSON.parse(cachedResponse));
                }
                res.sendResponse = res.json;
                res.json = function(body) {
                    redisClient.setEx(key, duration, JSON.stringify(body))
                        .catch(error => console.error('Cache error:', error));
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

// Cache invalidation middleware
async function invalidateCache(pattern) {
    try {
        const keys = await redisClient.keys(`cache:${pattern}`);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error);
    }
}

// Swagger configuration
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
                        updated_at: { type: 'string', format: 'date-time' }
                    }
                },
                Category: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        parent_id: { type: 'integer', nullable: true },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Comment: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        product_id: { type: 'integer' },
                        user_id: { type: 'integer' },
                        comment: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Tag: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        product_id: { type: 'integer' },
                        tag_name: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                }
            }
        }
    },
    apis: ['./index.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Database connections
const pgPool = new Pool({
    connectionString: POSTGRES_URI
});

const mongoClient = new MongoClient(MONGO_URI);

// Initialize function
async function init() {
    const app = express();
    
    // Connect to Redis and setup Elasticsearch
    await redisClient.connect();
    // await setupElasticsearch();
    
    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(limiter);
    app.use(speedLimiter);
    
    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
    
    // Initialize databases and system
    createDatabaseSchema()
        .then(() => setupMongoCollections())
        .then(() => optimizeSystemForService())
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
    app.post('/products', async function(req, res) {
        try {
            const result = await createProduct(req.body);
            const product = result.rows[0];
            await storeProductDocument(product);
            // await indexProduct(product);
            
            // Invalidate caches
            await invalidateCache('/products*');
            await invalidateCache(`/products/${product.id}`);
            
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
    app.get('/products/:id', cacheMiddleware(300), function(req, res) {
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
    app.get('/products', cacheMiddleware(300), function(req, res) {
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
    app.post('/categories', async function(req, res) {
        try {
            const result = await createCategory(req.body);
            await invalidateCache('/categories*');
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
    app.get('/categories/tree', cacheMiddleware(600), function(req, res) {
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
    app.post('/products/:productId/comments', async function(req, res) {
        try {
            const commentData = {
                ...req.body,
                product_id: req.params.productId
            };
            const result = await addComment(commentData);
            await invalidateCache(`/products/${req.params.productId}/comments`);
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
    app.get('/products/:productId/comments', cacheMiddleware(300), function(req, res) {
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
    app.post('/products/:productId/tags', async function(req, res) {
        try {
            const { tag_name } = req.body;
            const result = await addTagToProduct(req.params.productId, tag_name);
            await invalidateCache(`/products/tags/${tag_name}`);
            await invalidateCache(`/products/${req.params.productId}`);
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
    app.get('/products/tags/:tagName', cacheMiddleware(300), function(req, res) {
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
    app.get('/products/search/document', cacheMiddleware(300), function(req, res) {
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

    // /**
    //  * @swagger
    //  * /products/search/advanced:
    //  *   get:
    //  *     summary: Advanced product search using Elasticsearch
    //  *     tags: [Search]
    //  *     parameters:
    //  *       - in: query
    //  *         name: query
    //  *         schema:
    //  *           type: string
    //  *       - in: query
    //  *         name: category_id
    //  *         schema:
    //  *           type: integer
    //  *       - in: query
    //  *         name: min_price
    //  *         schema:
    //  *           type: number
    //  *       - in: query
    //  *         name: max_price
    //  *         schema:
    //  *           type: number
    //  *       - in: query
    //  *         name: tags
    //  *         schema:
    //  *           type: array
    //  *           items:
    //  *             type: string
    //  *       - in: query
    //  *         name: sort_by
    //  *         schema:
    //  *           type: string
    //  *       - in: query
    //  *         name: sort_order
    //  *         schema:
    //  *           type: string
    //  *           enum: [asc, desc]
    //  *       - in: query
    //  *         name: page
    //  *         schema:
    //  *           type: integer
    //  *       - in: query
    //  *         name: size
    //  *         schema:
    //  *           type: integer
    //  *     responses:
    //  *       200:
    //  *         description: Search results
    //  *         content:
    //  *           application/json:
    //  *             schema:
    //  *               type: object
    //  *               properties:
    //  *                 total:
    //  *                   type: integer
    //  *                 hits:
    //  *                   type: array
    //  *                   items:
    //  *                     $ref: '#/components/schemas/Product'
    //  *                 page:
    //  *                   type: integer
    //  *                 size:
    //  *                   type: integer
    //  *       500:
    //  *         description: Server error
    //  */
    // app.get('/products/search/advanced', cacheMiddleware(300), async function(req, res) {
    //     try {
    //         const results = await advancedSearch(req.query);
    //         res.json(results);
    //     } catch (error) {
    //         res.status(500).json({ error: error.message });
    //     }
    // });
    
    // Start server
    app.listen(PORT, function() {
        console.log(`Product service is running on port ${PORT}`);
        console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
    });
}

// Main function
function main() {
    init();
}

// Start the service
main();

// Database schema creation
function createDatabaseSchema() {
    const createTablesQuery = `
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            parent_id INTEGER REFERENCES categories(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    `;

    return pgPool.query(createTablesQuery);
}

// Linux utility functions
function executeLinuxCommand(command) {
    try {
        return execSync(command, { encoding: 'utf-8' });
    } catch (error) {
        console.error('Linux command execution failed:', error);
        throw error;
    }
}

function optimizeSystemForService() {
    // Increase system limits for better performance
    // executeLinuxCommand('ulimit -n 65535');
    // Clear system cache if needed
    // executeLinuxCommand('sync; echo 3 > /proc/sys/vm/drop_caches');
}

// MongoDB collections setup
async function setupMongoCollections() {
    await mongoClient.connect();
    const db = mongoClient.db();
    
    // Create indexes for better search performance
    await db.collection('product_documents').createIndex({ 
        name: 'text', 
        description: 'text' 
    });
    
    await db.collection('product_documents').createIndex({ 
        category_id: 1 
    });
}

// Product functions
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

// Category functions
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

// Comment functions
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
    return pgPool.query(
        'SELECT * FROM product_comments WHERE product_id = $1 ORDER BY created_at DESC',
        [product_id]
    );
}

// Tag functions
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

// MongoDB document functions
async function storeProductDocument(productData) {
    const db = mongoClient.db();
    const collection = db.collection('product_documents');
    
    // Store additional document data in MongoDB
    const document = {
        product_id: productData.id,
        name: productData.name,
        description: productData.description,
        category_id: productData.category_id,
        metadata: productData.metadata,
        created_at: new Date(),
        updated_at: new Date()
    };
    
    return collection.insertOne(document);
}

async function searchProductDocuments(searchQuery) {
    const db = mongoClient.db();
    const collection = db.collection('product_documents');
    
    // Create text search query
    const query = {
        $text: {
            $search: searchQuery
        }
    };
    
    return collection.find(query).toArray();
}
