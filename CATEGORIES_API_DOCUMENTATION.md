# Categories API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [API Endpoints](#api-endpoints)
4. [Data Models](#data-models)
5. [Advanced Features](#advanced-features)
6. [Analytics & Insights](#analytics--insights)
7. [Bulk Operations](#bulk-operations)
8. [Import/Export](#importexport)
9. [Validation & Security](#validation--security)
10. [Error Handling](#error-handling)
11. [Integration Points](#integration-points)
12. [Best Practices](#best-practices)

---

## Overview

The Categories API provides a comprehensive category management system for organizing products in an e-commerce platform. It supports hierarchical category structures, advanced analytics, bulk operations, and seamless integration with product management.

### Key Capabilities
- **Hierarchical Structure**: Multi-level category organization with parent-child relationships
- **SEO Optimization**: Automatic slug generation and redirect management
- **Advanced Analytics**: Performance metrics, growth analysis, and insights
- **Bulk Operations**: Efficient management of multiple categories
- **Import/Export**: Data portability in multiple formats
- **Validation & Security**: Comprehensive input validation and security measures

---

## Core Features

### 1. Hierarchical Category Management
- **Unlimited Depth**: Support for unlimited category nesting levels
- **Path Tracking**: Automatic path generation for efficient navigation
- **Level Management**: Automatic level calculation based on hierarchy
- **Parent-Child Relationships**: Seamless parent-child category associations

### 2. SEO & URL Management
- **Automatic Slug Generation**: SEO-friendly URLs based on category names
- **Custom Slugs**: Support for custom URL slugs
- **Redirect Management**: Automatic handling of slug changes and redirects
- **Meta Information**: Comprehensive SEO meta data support

### 3. Status Management
- **Multiple Statuses**: Active, inactive, draft, archived, hidden
- **Featured Categories**: Special highlighting for important categories
- **Approval Workflow**: Pending approval status for content moderation

### 4. Rich Content Support
- **Descriptions**: Detailed category descriptions
- **Images & Icons**: Visual representation with images and icons
- **Meta Data**: SEO-optimized meta titles, descriptions, and keywords
- **Custom Settings**: Flexible configuration options

---

## API Endpoints

### Base URL
```
/api/product/v1/categories
```

### 1. Create Category
**POST** `/categories`

Creates a new category with validation and automatic slug generation.

**Request Body:**
```json
{
  "name": "Electronics",
  "parent_id": null,
  "description": "Electronic devices and gadgets",
  "meta_title": "Electronics - Best Deals",
  "meta_description": "Find the best electronic devices",
  "meta_keywords": ["electronics", "gadgets", "devices"],
  "image_url": "https://example.com/electronics.jpg",
  "icon_url": "https://example.com/electronics-icon.png",
  "order": 1,
  "status": "active",
  "is_featured": true,
  "slug": "electronics"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "parent_id": null,
    "level": 1,
    "path": [],
    "description": "Electronic devices and gadgets",
    "status": "active",
    "is_featured": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Category created successfully"
}
```

### 2. Get Category by ID
**GET** `/categories/:id`

Retrieves a specific category by its ID.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "parent_id": null,
    "level": 1,
    "path": [],
    "description": "Electronic devices and gadgets",
    "product_count": 150,
    "subcategory_count": 5,
    "parent_name": null,
    "children": [
      {
        "id": 2,
        "name": "Smartphones",
        "slug": "electronics/smartphones",
        "parent_id": 1,
        "level": 2,
        "product_count": 45
      }
    ]
  }
}
```

### 3. Get Category by Slug
**GET** `/categories/slug/:slug`

Retrieves a category by its URL slug with redirect support.

**Query Parameters:**
- `includeChildren` (boolean): Include child categories
- `depth` (number): Depth of child categories to include
- `includeStats` (boolean): Include category statistics

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "parent_id": null,
    "level": 1,
    "path": [],
    "description": "Electronic devices and gadgets",
    "meta_title": "Electronics - Best Deals",
    "meta_description": "Find the best electronic devices",
    "meta_keywords": ["electronics", "gadgets", "devices"],
    "image_url": "https://example.com/electronics.jpg",
    "icon_url": "https://example.com/electronics-icon.png",
    "order": 1,
    "status": "active",
    "is_featured": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. Get Category Tree
**GET** `/categories/tree`

Retrieves the complete hierarchical category structure.

**Query Parameters:**
- `root_id` (number): Root category ID for subtree
- `max_depth` (number): Maximum depth to retrieve
- `include_stats` (boolean): Include category statistics

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "parent_id": null,
      "level": 1,
      "path": [],
      "product_count": 150,
      "subcategory_count": 5,
      "children": [
        {
          "id": 2,
          "name": "Smartphones",
          "slug": "electronics/smartphones",
          "parent_id": 1,
          "level": 2,
          "path": [1],
          "product_count": 45,
          "subcategory_count": 2,
          "children": [
            {
              "id": 3,
              "name": "iPhone",
              "slug": "electronics/smartphones/iphone",
              "parent_id": 2,
              "level": 3,
              "path": [1, 2],
              "product_count": 20,
              "subcategory_count": 0
            }
          ]
        }
      ]
    }
  ]
}
```

### 5. Update Category
**PUT** `/categories/:id`

Updates an existing category.

**Request Body:**
```json
{
  "name": "Electronics & Gadgets",
  "description": "Updated description",
  "status": "active",
  "is_featured": false,
  "order": 2
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics & Gadgets",
    "slug": "electronics-gadgets",
    "parent_id": null,
    "level": 1,
    "path": [],
    "description": "Updated description",
    "status": "active",
    "is_featured": false,
    "order": 2,
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Category updated successfully"
}
```

### 6. Delete Category
**DELETE** `/categories/:id`

Soft deletes a category (sets deleted_at timestamp).

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics",
    "deleted_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Category deleted successfully"
}
```

### 7. Search Categories
**GET** `/categories/search`

Advanced category search with filtering and pagination.

**Query Parameters:**
- `name` (string): Search by category name
- `slug` (string): Search by category slug
- `parent_id` (number): Filter by parent category
- `status` (string): Filter by status
- `is_featured` (boolean): Filter featured categories
- `page` (number): Page number for pagination
- `limit` (number): Items per page (max 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics",
        "parent_id": null,
        "level": 1,
        "product_count": 150,
        "subcategory_count": 5,
        "status": "active",
        "is_featured": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### 8. Get All Categories
**GET** `/categories`

Retrieves all categories with pagination and filtering.

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics",
        "parent_id": null,
        "level": 1,
        "product_count": 150,
        "subcategory_count": 5,
        "status": "active",
        "is_featured": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "pages": 2
    }
  }
}
```

---

## Data Models

### Category Model
```json
{
  "id": "INTEGER (Primary Key)",
  "name": "STRING(255) (Required)",
  "slug": "STRING(255) (Unique)",
  "slug_redirects": "JSONB (Array of old slugs)",
  "description": "TEXT",
  "parent_id": "INTEGER (Foreign Key)",
  "level": "INTEGER (Default: 1)",
  "path": "INTEGER[] (Array of parent IDs)",
  "order": "INTEGER (Default: 0)",
  "status": "ENUM('active', 'inactive', 'hidden')",
  "is_featured": "BOOLEAN (Default: false)",
  "image_url": "STRING(500)",
  "icon_url": "STRING(500)",
  "meta_title": "STRING(255)",
  "meta_description": "TEXT",
  "meta_keywords": "STRING[]",
  "attributes": "JSONB",
  "attribute_metadata": "JSONB",
  "settings": "JSONB",
  "created_at": "TIMESTAMP",
  "updated_at": "TIMESTAMP",
  "deleted_at": "TIMESTAMP (Soft delete)"
}
```

### Category Attribute Model
```json
{
  "id": "INTEGER (Primary Key)",
  "category_id": "INTEGER (Foreign Key)",
  "name": "STRING(255)",
  "type": "ENUM('text', 'number', 'boolean', 'date', 'enum', 'file', 'color', 'size')",
  "required": "BOOLEAN (Default: false)",
  "order": "INTEGER (Default: 0)",
  "created_at": "TIMESTAMP",
  "updated_at": "TIMESTAMP"
}
```

### Category Attribute Option Model
```json
{
  "id": "INTEGER (Primary Key)",
  "category_attribute_id": "INTEGER (Foreign Key)",
  "value": "STRING(255)",
  "order": "INTEGER (Default: 0)",
  "created_at": "TIMESTAMP",
  "updated_at": "TIMESTAMP"
}
```

---

## Advanced Features

### 1. Category Attributes
Categories can have custom attributes that products inherit:

**Create Category Attribute:**
```json
POST /categories/:id/attributes
{
  "name": "Brand",
  "type": "enum",
  "required": true,
  "order": 1,
  "options": [
    {"value": "Apple", "order": 1},
    {"value": "Samsung", "order": 2},
    {"value": "Google", "order": 3}
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "category_id": 1,
    "name": "Brand",
    "type": "enum",
    "required": true,
    "order": 1,
    "options": [
      {"id": 1, "value": "Apple", "order": 1},
      {"id": 2, "value": "Samsung", "order": 2},
      {"id": 3, "value": "Google", "order": 3}
    ]
  },
  "message": "Category attribute created successfully"
}
```

### 2. Category Cloning
**POST** `/categories/:id/clone`

Creates a copy of an existing category with all its attributes and settings.

**Request Body:**
```json
{
  "newName": "Electronics Copy",
  "includeAttributes": true,
  "includeSubcategories": false
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 10,
    "name": "Electronics Copy",
    "slug": "electronics-copy",
    "parent_id": null,
    "level": 1,
    "path": [],
    "description": "Electronic devices and gadgets",
    "status": "active",
    "is_featured": false,
    "attributes": [
      {
        "id": 5,
        "name": "Brand",
        "type": "enum",
        "required": true,
        "options": [
          {"value": "Apple", "order": 1},
          {"value": "Samsung", "order": 2}
        ]
      }
    ]
  },
  "message": "Category cloned successfully"
}
```

### 3. Category Reordering
**POST** `/categories/reorder`

Updates the order of multiple categories at once.

**Request Body:**
```json
{
  "orderedIds": [1, 3, 2, 4, 5]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {"id": 1, "order": 1},
    {"id": 3, "order": 2},
    {"id": 2, "order": 3},
    {"id": 4, "order": 4},
    {"id": 5, "order": 5}
  ],
  "message": "Categories reordered successfully"
}
```

### 4. Category Approval Workflow
**POST** `/categories/:id/approve`

Approves a category that was pending approval.

**Request Body:**
```json
{
  "approvedBy": "admin_user_id",
  "notes": "Category approved after review"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics",
    "status": "active",
    "approved_by": "admin_user_id",
    "approved_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Category approved successfully"
}
```

### 5. Slug Redirects
**POST** `/categories/:id/redirects`

Manages slug redirects for SEO purposes.

**Request Body:**
```json
{
  "oldSlug": "old-electronics",
  "newSlug": "electronics"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "slug_redirects": ["old-electronics"]
  },
  "message": "Slug redirect added successfully"
}
```

---

## Analytics & Insights

### 1. Category Analytics
**GET** `/categories/:id/analytics`

Comprehensive analytics for a category including:
- Product count and distribution
- Performance metrics
- Growth trends
- Attribute usage statistics
- Comparison with other categories

**Query Parameters:**
- `includeSubcategories` (boolean): Include subcategory data
- `includeProducts` (boolean): Include product analytics
- `includeAttributes` (boolean): Include attribute analytics
- `dateRange` (string): Time period (7d, 30d, 90d, 1y, all)
- `groupBy` (string): Grouping (day, week, month, year)

**Response:**
```json
{
  "status": "success",
  "data": {
    "category": {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "level": 1,
      "path": []
    },
    "overview": {
      "total_products": 150,
      "active_products": 145,
      "total_subcategories": 5,
      "total_views": 15000,
      "total_sales": 1200,
      "total_revenue": 45000.00,
      "avg_product_price": 300.00
    },
    "trends": {
      "product_growth": [
        {"date": "2024-01-01", "count": 140},
        {"date": "2024-01-02", "count": 145},
        {"date": "2024-01-03", "count": 150}
      ],
      "view_trends": [
        {"date": "2024-01-01", "views": 500},
        {"date": "2024-01-02", "views": 520},
        {"date": "2024-01-03", "views": 480}
      ]
    },
    "products": {
      "price_distribution": {
        "0-100": 20,
        "100-500": 80,
        "500-1000": 35,
        "1000+": 15
      },
      "top_products": [
        {"id": 1, "name": "iPhone 15", "views": 500, "sales": 45},
        {"id": 2, "name": "Samsung Galaxy", "views": 480, "sales": 38}
      ]
    },
    "attributes": {
      "most_used": [
        {"name": "Brand", "usage_count": 150},
        {"name": "Color", "usage_count": 120},
        {"name": "Storage", "usage_count": 100}
      ],
      "attribute_values": {
        "Brand": {
          "Apple": 60,
          "Samsung": 45,
          "Google": 25,
          "Other": 20
        }
      }
    },
    "performance": {
      "conversion_rate": 8.0,
      "avg_order_value": 375.00,
      "bounce_rate": 25.5,
      "time_on_page": 180
    },
    "comparisons": {
      "vs_average": {
        "product_count": "+20%",
        "conversion_rate": "+15%",
        "avg_order_value": "+25%"
      },
      "top_performing_subcategories": [
        {"id": 2, "name": "Smartphones", "performance_score": 85},
        {"id": 3, "name": "Laptops", "performance_score": 78}
      ]
    }
  }
}
```

### 2. Performance Metrics
**GET** `/categories/:id/performance`

Category performance metrics including:
- Views and impressions
- Sales and revenue
- Conversion rates
- Growth trends

**Query Parameters:**
- `dateRange` (string): Time period (7d, 30d, 90d, 1y, all)
- `metrics` (string): Comma-separated metrics (views, sales, revenue, conversion)

**Response:**
```json
{
  "status": "success",
  "data": {
    "views": {
      "total": 15000,
      "daily_avg": 500,
      "growth_rate": 12.5,
      "trend": "increasing"
    },
    "sales": {
      "total": 1200,
      "daily_avg": 40,
      "growth_rate": 8.3,
      "trend": "stable"
    },
    "revenue": {
      "total": 45000.00,
      "daily_avg": 1500.00,
      "growth_rate": 15.2,
      "trend": "increasing"
    },
    "conversion": {
      "rate": 8.0,
      "trend": "stable",
      "benchmark": 6.5
    }
  }
}
```

### 3. Hierarchy Analytics
**GET** `/categories/hierarchy/analytics`

Analytics for the entire category hierarchy.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics",
        "level": 1
      },
      "metrics": {
        "total_products": 150,
        "total_views": 15000,
        "total_sales": 1200,
        "conversion_rate": 8.0
      },
      "children": [
        {
          "category": {
            "id": 2,
            "name": "Smartphones",
            "slug": "electronics/smartphones",
            "level": 2
          },
          "metrics": {
            "total_products": 45,
            "total_views": 8000,
            "total_sales": 600,
            "conversion_rate": 7.5
          }
        }
      ]
    }
  ]
}
```

### 4. Growth Analysis
**GET** `/categories/:id/growth`

Growth analysis across different time periods.

**Query Parameters:**
- `periods` (string): Comma-separated periods (7d, 30d, 90d, 1y)
- `metrics` (string): Comma-separated metrics (products, views, sales)

**Response:**
```json
{
  "status": "success",
  "data": {
    "7d": {
      "products": {"growth": 5, "trend": "increasing"},
      "views": {"growth": 12, "trend": "increasing"},
      "sales": {"growth": 8, "trend": "stable"}
    },
    "30d": {
      "products": {"growth": 15, "trend": "increasing"},
      "views": {"growth": 25, "trend": "increasing"},
      "sales": {"growth": 18, "trend": "increasing"}
    },
    "90d": {
      "products": {"growth": 30, "trend": "increasing"},
      "views": {"growth": 45, "trend": "increasing"},
      "sales": {"growth": 35, "trend": "increasing"}
    },
    "1y": {
      "products": {"growth": 120, "trend": "increasing"},
      "views": {"growth": 180, "trend": "increasing"},
      "sales": {"growth": 150, "trend": "increasing"}
    }
  }
}
```

### 5. Comparison Reports
**POST** `/categories/comparison`

Compare multiple categories across various metrics.

**Request Body:**
```json
{
  "categoryIds": [1, 2, 3],
  "dateRange": "30d",
  "metrics": ["products", "views", "sales", "revenue"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      },
      "metrics": {
        "products": 150,
        "views": 15000,
        "sales": 1200,
        "revenue": 45000.00
      }
    },
    {
      "category": {
        "id": 2,
        "name": "Clothing",
        "slug": "clothing"
      },
      "metrics": {
        "products": 200,
        "views": 12000,
        "sales": 800,
        "revenue": 32000.00
      }
    }
  ]
}
```

### 6. Category Insights
**GET** `/categories/:id/insights`

AI-powered insights and recommendations for category optimization.

**Response:**
```json
{
  "status": "success",
  "data": {
    "category": {
      "id": 1,
      "name": "Electronics",
      "slug": "electronics"
    },
    "performance": {
      "score": 85,
      "strengths": [
        "High conversion rate",
        "Good product variety",
        "Strong brand presence"
      ],
      "weaknesses": [
        "High bounce rate",
        "Limited mobile optimization"
      ]
    },
    "opportunities": [
      "Add more budget-friendly options",
      "Improve mobile user experience",
      "Expand subcategory offerings"
    ],
    "recommendations": [
      "Optimize product images for mobile",
      "Add more product reviews",
      "Implement cross-selling strategies"
    ],
    "risks": [
      "Competition from new entrants",
      "Seasonal demand fluctuations"
    ]
  }
}
```

---

## Bulk Operations

### 1. Bulk Update Categories
**POST** `/categories/bulk-update`

Updates multiple categories simultaneously.

**Request Body:**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Updated Electronics",
      "status": "active"
    },
    {
      "id": 2,
      "name": "Updated Smartphones",
      "order": 5
    },
    {
      "id": 3,
      "description": "Updated description",
      "is_featured": true
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Updated Electronics",
      "status": "active",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Updated Smartphones",
      "order": 5,
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 3,
      "description": "Updated description",
      "is_featured": true,
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "message": "Categories updated successfully"
}
```

### 2. Bulk Delete Categories
**POST** `/categories/bulk-delete`

Soft deletes multiple categories.

**Request Body:**
```json
{
  "categoryIds": [1, 2, 3],
  "reason": "Category restructuring"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "deleted_count": 3,
    "deleted_categories": [
      {"id": 1, "name": "Electronics"},
      {"id": 2, "name": "Smartphones"},
      {"id": 3, "name": "Laptops"}
    ]
  },
  "message": "Categories deleted successfully"
}
```

### 3. Bulk Status Update
**POST** `/categories/bulk-status`

Updates status for multiple categories.

**Request Body:**
```json
{
  "categoryIds": [1, 2, 3],
  "status": "active",
  "reason": "Seasonal activation"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "updated_count": 3,
    "updated_categories": [
      {"id": 1, "name": "Electronics", "status": "active"},
      {"id": 2, "name": "Smartphones", "status": "active"},
      {"id": 3, "name": "Laptops", "status": "active"}
    ]
  },
  "message": "Category statuses updated successfully"
}
```

---

## Import/Export

### 1. Export Categories
**GET** `/categories/export/:format`

Exports categories in various formats.

**Supported Formats:**
- JSON
- CSV
- XML

**Query Parameters:**
- `includeSubcategories` (boolean): Include subcategories
- `includeAttributes` (boolean): Include category attributes

**JSON Export Response:**
```json
{
  "status": "success",
  "data": {
    "format": "json",
    "filename": "categories_export_2024-01-01.json",
    "content": [
      {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics",
        "parent_id": null,
        "level": 1,
        "description": "Electronic devices and gadgets",
        "status": "active",
        "is_featured": true,
        "attributes": [
          {
            "name": "Brand",
            "type": "enum",
            "required": true,
            "options": ["Apple", "Samsung", "Google"]
          }
        ],
        "children": [
          {
            "id": 2,
            "name": "Smartphones",
            "slug": "electronics/smartphones",
            "parent_id": 1,
            "level": 2
          }
        ]
      }
    ]
  }
}
```

### 2. Import Categories
**POST** `/categories/import/:format`

Imports categories from external sources.

**Request Body:**
```json
{
  "data": "base64_encoded_data_or_raw_content",
  "options": {
    "updateExisting": false,
    "skipErrors": false,
    "validateOnly": false
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "total": 10,
    "success": 8,
    "failed": 2,
    "errors": [
      {
        "row": 3,
        "error": "Category name is required"
      },
      {
        "row": 7,
        "error": "Duplicate slug: electronics"
      }
    ],
    "imported_categories": [
      {"id": 11, "name": "New Category 1"},
      {"id": 12, "name": "New Category 2"}
    ]
  },
  "message": "Import completed successfully"
}
```

---

## Validation & Security

### Input Validation Rules

**Category Name:**
- Required field
- 2-255 characters
- Alphanumeric with spaces, hyphens, and underscores
- No duplicate names within same parent

**Slug:**
- Optional custom slug
- URL-safe format (lowercase, hyphens only)
- No duplicate slugs
- Automatic generation from name if not provided

**Parent ID:**
- Valid integer
- Must reference existing category
- Prevents circular references
- Null for root categories

**Status:**
- Valid enum values: active, inactive, draft, archived, hidden
- Default: active

**Order:**
- Non-negative integer
- Default: 0

**URLs (image_url, icon_url):**
- Valid URL format
- Optional fields

### Security Features

**Rate Limiting:**
- 250 requests per 15 minutes per IP
- Slower response for high-frequency requests
- Different limits for different operations

**Input Sanitization:**
- XSS protection
- SQL injection prevention
- Parameterized queries

**Circular Reference Prevention:**
- Validates parent-child relationships
- Prevents infinite loops in hierarchy

**Soft Deletes:**
- Data preservation
- Audit trail maintenance
- Reversible operations

### Middleware Chain
1. **Validation**: Input validation using express-validator
2. **Authentication**: User authentication (if required)
3. **Authorization**: Permission checks
4. **Rate Limiting**: Request throttling
5. **Logging**: Operation logging
6. **Error Handling**: Comprehensive error management

---

## Error Handling

### Error Response Format
```json
{
  "status": "error",
  "message": "Error description",
  "data": null,
  "details": {
    "code": "ERROR_CODE",
    "field": "field_name",
    "value": "invalid_value"
  }
}
```

### Common Error Codes

**400 - Bad Request:**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    "Category name is required",
    "Slug format is invalid",
    "Parent ID must be a valid integer"
  ]
}
```

**404 - Category Not Found:**
```json
{
  "status": "error",
  "message": "Category not found",
  "data": null
}
```

**409 - Conflict:**
```json
{
  "status": "error",
  "message": "A category with this name already exists",
  "data": null
}
```

**422 - Unprocessable Entity:**
```json
{
  "status": "error",
  "message": "Cannot delete category with children",
  "data": null
}
```

**500 - Internal Server Error:**
```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null
}
```

### Database Error Handling
```json
{
  "status": "error",
  "message": "The specified parent category does not exist",
  "details": {
    "code": "23503",
    "table": "categories",
    "constraint": "parent_id_fkey"
  }
}
```

---

## Integration Points

### 1. Product Integration
Categories are tightly integrated with the product management system:

**Product Creation with Category:**
```json
{
  "name": "iPhone 15 Pro",
  "price": 999.99,
  "description": "Latest iPhone model",
  "category_id": 2,
  "attributes": [
    {
      "category_attribute_id": 1,
      "value": "Apple"
    },
    {
      "category_attribute_id": 2,
      "value": "256GB"
    }
  ]
}
```

**Category Products Response:**
```json
{
  "status": "success",
  "data": {
    "category": {
      "id": 2,
      "name": "Smartphones",
      "slug": "electronics/smartphones"
    },
    "products": [
      {
        "id": 1,
        "name": "iPhone 15 Pro",
        "price": 999.99,
        "category_id": 2,
        "attributes": {
          "Brand": "Apple",
          "Storage": "256GB",
          "Color": "Titanium"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### 2. Search Integration
Categories enhance product search capabilities:

**Search by Category:**
```json
{
  "category_id": 2,
  "filters": {
    "price_range": {"min": 500, "max": 1000},
    "attributes": {
      "Brand": "Apple",
      "Storage": "256GB"
    }
  },
  "sort": "price_asc",
  "page": 1,
  "limit": 20
}
```

### 3. Navigation Integration
Categories provide navigation structure:

**Breadcrumb Navigation:**
```json
{
  "status": "success",
  "data": [
    {"id": 1, "name": "Electronics", "slug": "electronics"},
    {"id": 2, "name": "Smartphones", "slug": "electronics/smartphones"},
    {"id": 3, "name": "iPhone", "slug": "electronics/smartphones/iphone"}
  ]
}
```

### 4. Analytics Integration
Categories contribute to overall analytics:

**Category Performance in Dashboard:**
```json
{
  "status": "success",
  "data": {
    "top_categories": [
      {
        "id": 2,
        "name": "Smartphones",
        "revenue": 45000.00,
        "growth": 15.2
      },
      {
        "id": 4,
        "name": "Laptops",
        "revenue": 32000.00,
        "growth": 8.5
      }
    ],
    "category_distribution": {
      "Electronics": 45,
      "Clothing": 30,
      "Home": 25
    }
  }
}
```

---

## Best Practices

### 1. Category Structure
- **Keep it Simple**: Don't create too many levels (max 3-4 levels recommended)
- **Consistent Naming**: Use clear, descriptive names
- **Logical Grouping**: Group related products together
- **SEO Optimization**: Use SEO-friendly slugs and meta data

### 2. Performance Optimization
- **Pagination**: Always use pagination for large datasets
- **Caching**: Implement caching for frequently accessed categories
- **Indexing**: Ensure proper database indexing
- **Lazy Loading**: Load subcategories on demand

### 3. Data Management
- **Soft Deletes**: Use soft deletes to preserve data integrity
- **Validation**: Always validate input data
- **Error Handling**: Implement comprehensive error handling
- **Logging**: Log important operations for audit trails

### 4. SEO Best Practices
- **Unique Slugs**: Ensure each category has a unique slug
- **Meta Data**: Provide comprehensive meta titles and descriptions
- **Redirects**: Handle slug changes with proper redirects
- **Structured Data**: Use proper schema markup

### 5. Security Considerations
- **Input Validation**: Validate all user inputs
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Authentication**: Secure sensitive operations
- **Authorization**: Check user permissions for admin operations

### 6. Analytics Best Practices
- **Regular Monitoring**: Monitor category performance regularly
- **A/B Testing**: Test different category structures
- **User Feedback**: Collect and analyze user feedback
- **Continuous Optimization**: Continuously optimize based on data

---

## Conclusion

The Categories API provides a robust, scalable, and feature-rich solution for category management in e-commerce applications. With its comprehensive set of features, advanced analytics, and flexible architecture, it can handle complex category hierarchies while maintaining excellent performance and user experience.

The system supports:
- **Unlimited hierarchical structures** with automatic path and level management
- **Advanced SEO features** including automatic slug generation and redirect management
- **Comprehensive analytics** with performance metrics, growth analysis, and AI-powered insights
- **Bulk operations** for efficient management of large category sets
- **Import/Export capabilities** in multiple formats for data portability
- **Robust validation and security** measures to ensure data integrity
- **Seamless integration** with product management and search systems

This documentation provides a complete reference for implementing and utilizing the Categories API effectively in any e-commerce platform. 