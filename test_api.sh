#!/bin/bash

# Colors for console output only
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Log file
LOG_FILE="api_test_$(date +%Y%m%d_%H%M%S).log"
API_BASE_URL="http://localhost:3000"

# Function to log messages (colored for console, plain for file)
log() {
    local message=$1
    local color=$2
    # Console output with color
    echo -e "${color:-$NC}$message${NC}"
    # File output without color codes
    echo "$message" >> "$LOG_FILE"
}

# Function to check last test result
check_last_test() {
    if [[ $? -ne 0 ]]; then
        log "Previous test failed. Stopping test suite." "$RED"
        exit 1
    fi
}

# Function to make API calls and log results
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_status=${5:-200}
    
    # Log test start
    log "\n=== Testing $description ===" "$YELLOW"
    log "Endpoint: $method $endpoint"
    if [ ! -z "$data" ]; then
        log "Data: $data"
    fi
    
    # Make API call
    local response
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -X "$method" -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}" "$API_BASE_URL$endpoint")
    fi
    
    # Parse response
    local status_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    # Log results
    log "Status Code: $status_code"
    log "Response: $body"
    
    # Check result
    if [[ $status_code -eq $expected_status ]]; then
        log "✓ Test passed" "$GREEN"
        return 0
    else
        log "✗ Test failed (Expected: $expected_status, Got: $status_code)" "$RED"
        return 1
    fi
}

# Start test suite
log "API Test Suite Started at $(date)" "$YELLOW"
log "API Base URL: $API_BASE_URL"

# 1. System Health Check
log "\n=== Testing System Health ===" "$YELLOW"
test_endpoint "GET" "/health" "" "Health Check"
check_last_test

# 2. Category Management (Base for products)
log "\n=== Testing Category Management ===" "$YELLOW"

# Create parent category
test_endpoint "POST" "/categories" '{
    "name": "Electronics",
    "parent_id": null
}' "Create Parent Category"
check_last_test

# Create subcategory
test_endpoint "POST" "/categories" '{
    "name": "Smartphones",
    "parent_id": 1
}' "Create Subcategory"
check_last_test

# Verify category structure
test_endpoint "GET" "/categories/tree" "" "Get Category Tree"
check_last_test

# 3. Product Management (Depends on categories)
log "\n=== Testing Product Management ===" "$YELLOW"

# Create first product
test_endpoint "POST" "/products" '{
    "name": "iPhone 13",
    "description": "Latest iPhone model",
    "price": 999.99,
    "category_id": 2,
    "metadata": {
        "brand": "Apple",
        "color": "Midnight Blue",
        "storage": "128GB"
    }
}' "Create Product 1"
check_last_test

# Create second product
test_endpoint "POST" "/products" '{
    "name": "Samsung Galaxy S21",
    "description": "Flagship Android phone",
    "price": 899.99,
    "category_id": 2,
    "metadata": {
        "brand": "Samsung",
        "color": "Phantom Gray",
        "storage": "256GB"
    }
}' "Create Product 2"
check_last_test

# Test product retrieval
test_endpoint "GET" "/products" "" "Get All Products"
check_last_test

test_endpoint "GET" "/products?category_id=2" "" "Get Products by Category"
check_last_test

test_endpoint "GET" "/products?min_price=800&max_price=1000" "" "Get Products with Price Filter"
check_last_test

# 4. Product Variants (Depends on products)
log "\n=== Testing Product Variants ===" "$YELLOW"

test_endpoint "POST" "/products/1/variants" '{
    "sku": "IP13-256-BLK",
    "name": "iPhone 13 256GB Black",
    "price": 1099.99,
    "stock_quantity": 50,
    "attributes": {
        "storage": "256GB",
        "color": "Black"
    }
}' "Create Product Variant"
check_last_test

test_endpoint "GET" "/products/1/variants" "" "Get Product Variants"
check_last_test

# 5. Product Images (Depends on products)
log "\n=== Testing Product Images ===" "$YELLOW"

test_endpoint "POST" "/products/1/images" '{
    "image_url": "https://example.com/iphone13-main.jpg",
    "is_primary": true,
    "order_index": 1
}' "Add Primary Product Image"
check_last_test

test_endpoint "POST" "/products/1/images" '{
    "image_url": "https://example.com/iphone13-angle.jpg",
    "is_primary": false,
    "order_index": 2
}' "Add Secondary Product Image"
check_last_test

test_endpoint "GET" "/products/1/images" "" "Get Product Images"
check_last_test

# 6. Product Attributes (Depends on products)
log "\n=== Testing Product Attributes ===" "$YELLOW"

test_endpoint "POST" "/products/1/attributes" '{
    "attribute_id": 1,
    "value": "A15 Bionic"
}' "Add Product Attribute (Processor)"
check_last_test

test_endpoint "POST" "/products/1/attributes" '{
    "attribute_id": 2,
    "value": "6.1 inches"
}' "Add Product Attribute (Screen Size)"
check_last_test

test_endpoint "GET" "/products/1/attributes" "" "Get Product Attributes"
check_last_test

# 7. Price Management (Depends on products and variants)
log "\n=== Testing Price Management ===" "$YELLOW"

test_endpoint "POST" "/products/1/price-history" '{
    "variant_id": 1,
    "price": 1049.99,
    "change_reason": "Holiday season price adjustment"
}' "Add Price History"
check_last_test

test_endpoint "GET" "/products/1/price-history" "" "Get Price History"
check_last_test

test_endpoint "GET" "/products/1/price-statistics" "" "Get Price Statistics"
check_last_test

test_endpoint "GET" "/products/1/price-trends?period=30%20days" "" "Get Price Trends"
check_last_test

# 8. Product Relationships (Depends on products)
log "\n=== Testing Product Relationships ===" "$YELLOW"

test_endpoint "POST" "/products/1/relationships" '{
    "related_product_id": 2,
    "relationship_type": "similar"
}' "Add Similar Product Relationship"
check_last_test

test_endpoint "GET" "/products/1/relationships" "" "Get Product Relationships"
check_last_test

test_endpoint "GET" "/products/1/relationships?relationship_type=similar" "" "Get Product Relationships by Type"
check_last_test

# 9. Product Versions (Depends on products)
log "\n=== Testing Product Versions ===" "$YELLOW"

test_endpoint "POST" "/products/1/versions" '{
    "version_number": 2,
    "changes": {
        "price": "Updated to 1049.99",
        "description": "Updated with new features",
        "metadata": {
            "added_colors": ["Starlight", "Pink"]
        }
    },
    "created_by": 1
}' "Create Product Version"
check_last_test

test_endpoint "GET" "/products/1/versions" "" "Get Product Versions"
check_last_test

# 10. Reviews (Depends on products)
log "\n=== Testing Product Reviews ===" "$YELLOW"

test_endpoint "POST" "/products/1/reviews" '{
    "user_id": 1,
    "rating": 5,
    "review_text": "Excellent product with amazing features!",
    "is_verified": true
}' "Add Product Review"
check_last_test

test_endpoint "GET" "/products/1/reviews" "" "Get Product Reviews"
check_last_test

# 11. Comments (Depends on products)
log "\n=== Testing Product Comments ===" "$YELLOW"

test_endpoint "POST" "/products/1/comments" '{
    "user_id": 1,
    "comment": "When will the new color variants be available?"
}' "Add Product Comment"
check_last_test

test_endpoint "GET" "/products/1/comments" "" "Get Product Comments"
check_last_test

# 12. Tags (Depends on products)
log "\n=== Testing Product Tags ===" "$YELLOW"

test_endpoint "POST" "/products/1/tags" '{
    "tag_name": "flagship"
}' "Add Product Tag"
check_last_test

test_endpoint "GET" "/products/tags/flagship" "" "Get Products by Tag"
check_last_test

# 13. Wishlist (Depends on products)
log "\n=== Testing Wishlist ===" "$YELLOW"

test_endpoint "POST" "/users/1/wishlist" '{
    "product_id": 1
}' "Add to Wishlist"
check_last_test

test_endpoint "GET" "/users/1/wishlist" "" "Get User Wishlist"
check_last_test

# 14. Chat System (Depends on products)
log "\n=== Testing Chat System ===" "$YELLOW"

test_endpoint "POST" "/products/1/chats" '{
    "user_id": 1,
    "seller_id": 2
}' "Create Product Chat"
check_last_test

test_endpoint "GET" "/users/1/chats" "" "Get User Chats"
check_last_test

test_endpoint "POST" "/chats/1/messages" '{
    "sender_id": 1,
    "message": "Is this product available in other colors?"
}' "Add Chat Message"
check_last_test

test_endpoint "GET" "/chats/1/messages" "" "Get Chat Messages"
check_last_test

test_endpoint "POST" "/chats/1/read" '{
    "user_id": 2
}' "Mark Chat Messages as Read"
check_last_test

# 15. Search and Recommendations (Depends on products)
log "\n=== Testing Search and Recommendations ===" "$YELLOW"

test_endpoint "GET" "/products/search/document?q=iphone" "" "Search Products by Document"
check_last_test

test_endpoint "GET" "/products/1/recommendations" "" "Get Product Recommendations"
check_last_test

# 16. Analytics (Depends on categories and products)
log "\n=== Testing Analytics ===" "$YELLOW"

test_endpoint "GET" "/categories/2/analytics" "" "Get Category Analytics"
check_last_test

# End of test suite
log "\n=== API Test Suite Completed at $(date) ===" "$YELLOW"
log "Full test results have been saved to: $LOG_FILE" 