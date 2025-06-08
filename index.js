import express from "express";
import { execSync } from "child_process";
import { Pool } from "pg";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { createClient } from "redis";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
// import { Client } from '@elastic/elasticsearch';

// Load environment variables
dotenv.config();

// Constants
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;
const POSTGRES_URI =
  process.env.POSTGRES_URI ||
  "postgresql://postgres:postgres@localhost:5432/product_db";
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/product_db";
const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";
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
  url: REDIS_URI,
});

redisClient.on("error", function (err) {
  console.error("Redis Client Error:", err);
});

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

// Slow down configuration for potential DDoS attacks
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes, then...
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  },
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

// Advanced caching system
const CACHE_PREFIXES = {
  PRODUCT: "product:",
  CATEGORY: "category:",
  TAG: "tag:",
  COMMENT: "comment:",
  CHAT: "chat:",
  ANALYTICS: "analytics:",
};

const CACHE_TTL = {
  PRODUCT: 300, // 5 minutes
  CATEGORY: 600, // 10 minutes
  TAG: 300,
  COMMENT: 300,
  CHAT: 300,
  ANALYTICS: 600,
};

async function getCachedData(key, fetchData, ttl) {
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const data = await fetchData();
    await redisClient.setEx(key, ttl, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Cache error:", error);
    return fetchData();
  }
}

async function invalidateCachePattern(pattern) {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("Cache invalidation error:", error);
  }
}

// Enhanced cache middleware
function enhancedCacheMiddleware(prefix, ttl) {
  return function (req, res, next) {
    if (req.method !== "GET") {
      return next();
    }

    const key = `${prefix}${req.originalUrl}`;
    redisClient
      .get(key)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return res.json(JSON.parse(cachedResponse));
        }

        res.sendResponse = res.json;
        res.json = function (body) {
          redisClient
            .setEx(key, ttl, JSON.stringify(body))
            .catch((error) => console.error("Cache error:", error));
          res.sendResponse(body);
        };
        next();
      })
      .catch((error) => {
        console.error("Cache error:", error);
        next();
      });
  };
}

// Cache warming function
async function warmCache() {
  try {
    // Warm product cache
    const products = await pgPool.query(
      "SELECT id FROM products ORDER BY created_at DESC LIMIT 100"
    );
    for (const product of products.rows) {
      const key = `${CACHE_PREFIXES.PRODUCT}${product.id}`;
      const data = await getProductById(product.id);
      await redisClient.setEx(
        key,
        CACHE_TTL.PRODUCT,
        JSON.stringify(data.rows[0])
      );
    }

    // Warm category cache
    const categories = await pgPool.query("SELECT id FROM categories");
    for (const category of categories.rows) {
      const key = `${CACHE_PREFIXES.CATEGORY}${category.id}`;
      const data = await getCategoryTree();
      await redisClient.setEx(
        key,
        CACHE_TTL.CATEGORY,
        JSON.stringify(data.rows)
      );
    }

    // Warm analytics cache
    const analytics = await pgPool.query(
      "SELECT id FROM products ORDER BY created_at DESC LIMIT 50"
    );
    for (const product of analytics.rows) {
      const key = `${CACHE_PREFIXES.ANALYTICS}${product.id}`;
      const data = await getProductAnalytics(product.id);
      await redisClient.setEx(
        key,
        CACHE_TTL.ANALYTICS,
        JSON.stringify(data.rows[0])
      );
    }

    console.log("Cache warming completed successfully");
  } catch (error) {
    console.error("Cache warming error:", error);
  }
}

// Schedule cache warming
function scheduleCacheWarming() {
  // Warm cache every 4 hours
  setInterval(warmCache, 4 * 60 * 60 * 1000);
}

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Product Microservice API",
      version: "1.0.0",
      description:
        "A comprehensive product management microservice with category, tag, and comment support",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
    components: {
      schemas: {
        Product: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number", format: "float" },
            category_id: { type: "integer" },
            metadata: { type: "object" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            parent_id: { type: "integer", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "integer" },
            product_id: { type: "integer" },
            user_id: { type: "integer" },
            comment: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Tag: {
          type: "object",
          properties: {
            id: { type: "integer" },
            product_id: { type: "integer" },
            tag_name: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  apis: ["./index.js"], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Database connections
const pgPool = new Pool({
  connectionString: POSTGRES_URI,
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
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

  // Initialize databases and system
  createDatabaseSchema()
    .then(() => setupMongoCollections())
    // .then(() => optimizeSystemForService())
    .then(() => scheduleMaterializedViewRefresh())
    .then(() => scheduleCacheWarming())
    .then(() => warmCache()) // Initial cache warming
    .catch((error) => {
      console.error("Initialization failed:", error);
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
  app.post("/products", async function (req, res) {
    try {
      const result = await createProduct(req.body);
      const product = result.rows[0];
      await storeProductDocument(product);
      // await indexProduct(product);

      // Invalidate caches
      await invalidateCachePattern("/products*");
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
  app.get(
    "/products/:id",
    enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT),
    function (req, res) {
      getProductById(req.params.id)
        .then((result) => {
          if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
          }
          res.json(result.rows[0]);
        })
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.get(
    "/products",
    enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT),
    function (req, res) {
      searchProducts(req.query)
        .then((result) => res.json(result.rows))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.post("/categories", async function (req, res) {
    try {
      const result = await createCategory(req.body);
      await invalidateCachePattern("/categories*");
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
  app.get(
    "/categories/tree",
    enhancedCacheMiddleware(CACHE_PREFIXES.CATEGORY, CACHE_TTL.CATEGORY),
    function (req, res) {
      getCategoryTree()
        .then((result) => res.json(result.rows))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.post("/products/:productId/comments", async function (req, res) {
    try {
      const commentData = {
        ...req.body,
        product_id: req.params.productId,
      };
      const result = await addComment(commentData);
      await invalidateCachePattern(
        `/products/${req.params.productId}/comments`
      );
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
  app.get(
    "/products/:productId/comments",
    enhancedCacheMiddleware(CACHE_PREFIXES.COMMENT, CACHE_TTL.COMMENT),
    function (req, res) {
      getProductComments(req.params.productId)
        .then((result) => res.json(result.rows))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.post("/products/:productId/tags", async function (req, res) {
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
  app.get(
    "/products/tags/:tagName",
    enhancedCacheMiddleware(CACHE_PREFIXES.TAG, CACHE_TTL.TAG),
    function (req, res) {
      getProductsByTag(req.params.tagName)
        .then((result) => res.json(result.rows))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.get(
    "/products/search/document",
    enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT),
    function (req, res) {
      try {
        const { q } = req.query;
        if (!q) {
          return res.status(400).json({ error: "Search query is required" });
        }
        searchProductDocuments(q)
          .then((results) => res.json(results))
          .catch((error) => res.status(500).json({ error: error.message }));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

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

  // Chat functions
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
  app.post("/products/:productId/chats", async function (req, res) {
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
  app.get(
    "/users/:userId/chats",
    enhancedCacheMiddleware(CACHE_PREFIXES.CHAT, CACHE_TTL.CHAT),
    function (req, res) {
      getProductChats(req.params.userId)
        .then((result) => res.json(result.rows))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.post("/chats/:chatId/messages", async function (req, res) {
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
  app.get(
    "/chats/:chatId/messages",
    enhancedCacheMiddleware(CACHE_PREFIXES.CHAT, CACHE_TTL.CHAT),
    function (req, res) {
      getChatMessages(req.params.chatId)
        .then((result) => res.json(result.rows))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.post("/chats/:chatId/read", async function (req, res) {
    try {
      const result = await markChatMessagesAsRead(
        req.params.chatId,
        req.body.user_id
      );
      await invalidateCachePattern(`/chats/${req.params.chatId}/messages`);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add analytics endpoints
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
  app.get(
    "/products/:productId/analytics",
    enhancedCacheMiddleware(CACHE_PREFIXES.ANALYTICS, CACHE_TTL.ANALYTICS),
    function (req, res) {
      getProductAnalytics(req.params.productId)
        .then((result) => {
          if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
          }
          res.json(result.rows[0]);
        })
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

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
  app.get(
    "/categories/:categoryId/analytics",
    enhancedCacheMiddleware(CACHE_PREFIXES.ANALYTICS, CACHE_TTL.ANALYTICS),
    function (req, res) {
      getCategoryAnalytics(req.params.categoryId)
        .then((result) => {
          if (result.rows.length === 0) {
            return res.status(404).json({ error: "Category not found" });
          }
          res.json(result.rows);
        })
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

  // Add recommendation endpoint
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
  app.get(
    "/products/:productId/recommendations",
    enhancedCacheMiddleware(CACHE_PREFIXES.PRODUCT, CACHE_TTL.PRODUCT),
    function (req, res) {
      getProductRecommendations(req.params.productId)
        .then((result) => res.json(result))
        .catch((error) => res.status(500).json({ error: error.message }));
    }
  );

  // Start server
  app.listen(PORT, function () {
    console.log(`Product service is running on port ${PORT}`);
    console.log(
      `Swagger documentation available at http://localhost:${PORT}/api-docs`
    );
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
        -- Install required extensions
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        
        -- Drop existing triggers if they exist
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
    `;

  return pgPool.query(createTablesQuery);
}

// Add function to refresh materialized views
async function refreshMaterializedViews() {
  try {
    await pgPool.query("REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats");
    console.log("Materialized views refreshed successfully");
  } catch (error) {
    console.error("Error refreshing materialized views:", error);
    throw error;
  }
}

// Add scheduled refresh of materialized views
function scheduleMaterializedViewRefresh() {
  // Refresh every hour
  setInterval(refreshMaterializedViews, 60 * 60 * 1000);
}

// Linux utility functions
function executeLinuxCommand(command) {
  try {
    return execSync(command, { encoding: "utf-8" });
  } catch (error) {
    console.error("Linux command execution failed:", error);
    throw error;
  }
}

function optimizeSystemForService() {
  // Increase system limits for better performance
  executeLinuxCommand("ulimit -n 65535");

  // Optimize PostgreSQL settings
  executeLinuxCommand(
    'sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = 500;"'
  );
  executeLinuxCommand(
    'sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = 2GB;"'
  );
  executeLinuxCommand(
    'sudo -u postgres psql -c "ALTER SYSTEM SET effective_cache_size = 6GB;"'
  );
  executeLinuxCommand(
    'sudo -u postgres psql -c "ALTER SYSTEM SET maintenance_work_mem = 512MB;"'
  );
  executeLinuxCommand(
    'sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = 16MB;"'
  );

  // Clear system cache if needed
  executeLinuxCommand("sync; echo 3 > /proc/sys/vm/drop_caches");

  // Optimize Redis settings
  executeLinuxCommand("redis-cli config set maxmemory 2gb");
  executeLinuxCommand("redis-cli config set maxmemory-policy allkeys-lru");

  // Set CPU governor to performance mode
  executeLinuxCommand(
    "echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor"
  );
}

// MongoDB collections setup
async function setupMongoCollections() {
  await mongoClient.connect();
  const db = mongoClient.db();

  // Create indexes for better search performance
  await db.collection("product_documents").createIndex({
    name: "text",
    description: "text",
  });

  await db.collection("product_documents").createIndex({
    category_id: 1,
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
  return pgPool.query("SELECT * FROM products WHERE id = $1", [id]);
}

function searchProducts(searchParams) {
  let query = "SELECT * FROM products WHERE 1=1";
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
    "SELECT * FROM product_comments WHERE product_id = $1 ORDER BY created_at DESC",
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
  const collection = db.collection("product_documents");

  // Store additional document data in MongoDB
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
  const collection = db.collection("product_documents");

  // Create text search query
  const query = {
    $text: {
      $search: searchQuery,
    },
  };

  return collection.find(query).toArray();
}

// Chat functions
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

// Simple neural network for product recommendations
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
    this.hidden = input.map((x) =>
      this.sigmoid(this.weights1.reduce((sum, w, i) => sum + w * x[i], 0))
    );
    return this.hidden.map((h) =>
      this.sigmoid(this.weights2.reduce((sum, w, i) => sum + w * h[i], 0))
    );
  }

  train(input, target, learningRate = 0.1) {
    const output = this.forward(input);
    const outputError = target.map((t, i) => t - output[i]);
    const outputDelta = outputError.map(
      (e, i) => e * this.sigmoidDerivative(output[i])
    );

    const hiddenError = this.weights2.map((w) =>
      w.reduce((sum, weight, i) => sum + weight * outputDelta[i], 0)
    );
    const hiddenDelta = hiddenError.map(
      (e, i) => e * this.sigmoidDerivative(this.hidden[i])
    );

    // Update weights
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

// Product recommendation functions
async function trainRecommendationModel() {
  try {
    // Get user purchase history and product interactions
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

    // Prepare training data
    const trainingData = result.rows.map((row) => ({
      input: [
        row.category_id / 100, // Normalize category_id
        row.view_count / 1000, // Normalize view_count
        row.tag_count / 10, // Normalize tag_count
        row.avg_price / 1000, // Normalize price
      ],
      output: [row.view_count > 10 ? 1 : 0], // Binary classification: popular or not
    }));

    // Create and train neural network
    const nn = new SimpleNeuralNetwork(4, 8, 1);
    for (let i = 0; i < 1000; i++) {
      trainingData.forEach((data) => {
        nn.train(data.input, data.output);
      });
    }

    return nn;
  } catch (error) {
    console.error("Error training recommendation model:", error);
    throw error;
  }
}

async function getProductRecommendations(productId) {
  try {
    const product = await getProductById(productId);
    if (!product.rows.length) {
      throw new Error("Product not found");
    }

    const model = await trainRecommendationModel();

    // Get similar products
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

    // Score products using neural network
    const scoredProducts = result.rows.map((row) => {
      const input = [
        row.category_id / 100,
        row.view_count / 1000,
        row.tag_count / 10,
        row.price / 1000,
      ];
      const score = model.forward(input)[0];
      return { ...row, score };
    });

    return scoredProducts.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Error getting product recommendations:", error);
    throw error;
  }
}

// Analytics functions
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
