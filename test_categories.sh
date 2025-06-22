#!/bin/bash

# ======================================================================
# Automated Category API Testing Script
# This script tests all category-related endpoints with random data
# Make sure the server is running on port 5003 before executing
# ======================================================================

BASE_URL="http://localhost:5003/api/product/v1/categories"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to generate random strings
generate_random_string() {
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w $1 | head -n 1
}

# Function to generate random number
generate_random_number() {
    echo $((RANDOM % $1 + 1))
}

# Function to make API calls and handle responses
make_api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    print_status "Testing: $method $endpoint - $description"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint")
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    # Extract response body (all lines except last)
    response_body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
        print_success "Status: $status_code"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    else
        print_error "Status: $status_code"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    fi
    echo ""
}

# Generate random data for testing
RANDOM_SUFFIX=$(generate_random_string 8)
CATEGORY_NAME_1="Electronics_$RANDOM_SUFFIX"
CATEGORY_NAME_2="Smartphones_$RANDOM_SUFFIX"
CATEGORY_NAME_3="Laptops_$RANDOM_SUFFIX"
ATTRIBUTE_NAME_1="Color_$RANDOM_SUFFIX"
ATTRIBUTE_NAME_2="Size_$RANDOM_SUFFIX"
OPTION_VALUE_1="Black_$RANDOM_SUFFIX"
OPTION_VALUE_2="White_$RANDOM_SUFFIX"

# Store created IDs for cleanup
CREATED_CATEGORY_IDS=()
CREATED_ATTRIBUTE_IDS=()
CREATED_OPTION_IDS=()

echo "========================================="
echo "Category API Comprehensive Testing"
echo "========================================="
echo "Random suffix: $RANDOM_SUFFIX"
echo ""

# Test 1: Create parent category
print_status "=== Creating Parent Category ==="
parent_category_data='{
    "name": "'$CATEGORY_NAME_1'",
    "description": "All kinds of electronic gadgets and devices",
    "parentId": null,
    "status": "active",
    "is_featured": true,
    "meta_title": "Electronics Store",
    "meta_description": "Best electronics collection",
    "meta_keywords": ["electronics", "gadgets", "devices"],
    "image_url": "https://example.com/electronics.jpg",
    "icon_url": "https://example.com/electronics-icon.png",
    "order": 1
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/" \
    -H "Content-Type: application/json" \
    -d "$parent_category_data")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Parent category created successfully"
    PARENT_CATEGORY_ID=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_CATEGORY_IDS+=($PARENT_CATEGORY_ID)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create parent category"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
    exit 1
fi
echo ""

# Test 2: Create child category
print_status "=== Creating Child Category ==="
child_category_data='{
    "name": "'$CATEGORY_NAME_2'",
    "description": "Latest smartphones and mobile devices",
    "parentId": '$PARENT_CATEGORY_ID',
    "status": "active",
    "is_featured": false,
    "meta_title": "Smartphones Collection",
    "meta_description": "Best smartphones collection",
    "meta_keywords": ["smartphones", "mobile", "phones"],
    "image_url": "https://example.com/smartphones.jpg",
    "icon_url": "https://example.com/smartphones-icon.png",
    "order": 1
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/" \
    -H "Content-Type: application/json" \
    -d "$child_category_data")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Child category created successfully"
    CHILD_CATEGORY_ID=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_CATEGORY_IDS+=($CHILD_CATEGORY_ID)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create child category"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
fi
echo ""

# Test 3: Create another child category
print_status "=== Creating Another Child Category ==="
laptop_category_data='{
    "name": "'$CATEGORY_NAME_3'",
    "description": "High-performance laptops and computers",
    "parentId": '$PARENT_CATEGORY_ID',
    "status": "active",
    "is_featured": true,
    "meta_title": "Laptops Collection",
    "meta_description": "Best laptops collection",
    "meta_keywords": ["laptops", "computers", "notebooks"],
    "image_url": "https://example.com/laptops.jpg",
    "icon_url": "https://example.com/laptops-icon.png",
    "order": 2
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/" \
    -H "Content-Type: application/json" \
    -d "$laptop_category_data")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Laptop category created successfully"
    LAPTOP_CATEGORY_ID=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_CATEGORY_IDS+=($LAPTOP_CATEGORY_ID)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create laptop category"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
fi
echo ""

# Test 4: Get featured categories
print_status "=== Testing Featured Categories ==="
make_api_call "GET" "/featured?limit=5" "" "Get featured categories"

# Test 5: Get category tree
print_status "=== Testing Category Tree ==="
make_api_call "GET" "/tree" "" "Get category tree structure"

# Test 6: Search categories
print_status "=== Testing Category Search ==="
make_api_call "GET" "/search?name=Smart" "" "Search categories by name"
make_api_call "GET" "/search?status=active" "" "Search active categories"
make_api_call "GET" "/search?is_featured=true" "" "Search featured categories"

# Test 7: Get all categories with pagination
print_status "=== Testing Category Pagination ==="
make_api_call "GET" "/?page=1&limit=10" "" "Get first page of categories"
make_api_call "GET" "/?page=1&limit=5&status=active" "" "Get active categories with limit"

# Test 8: Get category by slug
print_status "=== Testing Category by Slug ==="
# Convert category name to slug format
SLUG_1=$(echo "$CATEGORY_NAME_1" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
make_api_call "GET" "/slug/$SLUG_1" "" "Get category by slug"

# Test 9: Get category by ID
print_status "=== Testing Category by ID ==="
make_api_call "GET" "/$PARENT_CATEGORY_ID" "" "Get parent category by ID"
make_api_call "GET" "/$CHILD_CATEGORY_ID" "" "Get child category by ID"

# Test 10: Update category
print_status "=== Testing Category Update ==="
update_data='{
    "name": "Updated_'$CATEGORY_NAME_1'",
    "description": "Updated description for electronics",
    "status": "active",
    "is_featured": false,
    "meta_title": "Updated Electronics Store",
    "order": 5
}'
make_api_call "PUT" "/$PARENT_CATEGORY_ID" "$update_data" "Update parent category"

# Test 11: Get category breadcrumb
print_status "=== Testing Category Breadcrumb ==="
make_api_call "GET" "/$CHILD_CATEGORY_ID/breadcrumb" "" "Get breadcrumb for child category"

# Test 12: Get category statistics
print_status "=== Testing Category Statistics ==="
make_api_call "GET" "/$PARENT_CATEGORY_ID/stats" "" "Get parent category statistics"

# Test 13: Reorder categories
print_status "=== Testing Category Reordering ==="
reorder_data='{
    "orderedIds": ['$LAPTOP_CATEGORY_ID', '$CHILD_CATEGORY_ID', '$PARENT_CATEGORY_ID']
}'
make_api_call "POST" "/reorder" "$reorder_data" "Reorder categories"

# Test 14: Bulk update categories
print_status "=== Testing Bulk Category Update ==="
bulk_update_data='{
    "categories": [
        {"id": '$PARENT_CATEGORY_ID', "status": "active", "is_featured": true},
        {"id": '$CHILD_CATEGORY_ID', "status": "active", "order": 1},
        {"id": '$LAPTOP_CATEGORY_ID', "status": "active", "order": 2}
    ]
}'
make_api_call "PUT" "/bulk" "$bulk_update_data" "Bulk update categories"

# Test 15: Add attribute to category
print_status "=== Testing Category Attributes ==="
attribute_data='{
    "name": "'$ATTRIBUTE_NAME_1'",
    "type": "enum",
    "required": true,
    "order": 1
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/$CHILD_CATEGORY_ID/attributes" \
    -H "Content-Type: application/json" \
    -d "$attribute_data")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Attribute created successfully"
    ATTRIBUTE_ID_1=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_ATTRIBUTE_IDS+=($ATTRIBUTE_ID_1)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create attribute"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
fi
echo ""

# Test 16: Add another attribute
print_status "=== Adding Another Attribute ==="
attribute_data_2='{
    "name": "'$ATTRIBUTE_NAME_2'",
    "type": "string",
    "required": false,
    "order": 2
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/$CHILD_CATEGORY_ID/attributes" \
    -H "Content-Type: application/json" \
    -d "$attribute_data_2")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Second attribute created successfully"
    ATTRIBUTE_ID_2=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_ATTRIBUTE_IDS+=($ATTRIBUTE_ID_2)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create second attribute"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
fi
echo ""

# Test 17: Get attributes for category
print_status "=== Testing Get Category Attributes ==="
make_api_call "GET" "/$CHILD_CATEGORY_ID/attributes" "" "Get attributes for child category"

# Test 18: Update attribute
print_status "=== Testing Attribute Update ==="
update_attribute_data='{
    "name": "Updated_'$ATTRIBUTE_NAME_1'",
    "type": "enum",
    "required": false,
    "order": 3
}'
make_api_call "PUT" "/attributes/$ATTRIBUTE_ID_1" "$update_attribute_data" "Update attribute"

# Test 19: Add option to attribute
print_status "=== Testing Attribute Options ==="
option_data='{
    "value": "'$OPTION_VALUE_1'",
    "order": 1
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/attributes/$ATTRIBUTE_ID_1/options" \
    -H "Content-Type: application/json" \
    -d "$option_data")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Option created successfully"
    OPTION_ID_1=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_OPTION_IDS+=($OPTION_ID_1)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create option"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
fi
echo ""

# Test 20: Add another option
print_status "=== Adding Another Option ==="
option_data_2='{
    "value": "'$OPTION_VALUE_2'",
    "order": 2
}'

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/attributes/$ATTRIBUTE_ID_1/options" \
    -H "Content-Type: application/json" \
    -d "$option_data_2")

status_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | head -n -1)

if [ "$status_code" -eq 201 ]; then
    print_success "Second option created successfully"
    OPTION_ID_2=$(echo "$response_body" | jq -r '.id // .data.id')
    CREATED_OPTION_IDS+=($OPTION_ID_2)
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
    print_error "Failed to create second option"
    echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
fi
echo ""

# Test 21: Get options for attribute
print_status "=== Testing Get Attribute Options ==="
make_api_call "GET" "/attributes/$ATTRIBUTE_ID_1/options" "" "Get options for attribute"

# Test 22: Update option
print_status "=== Testing Option Update ==="
update_option_data='{
    "value": "Updated_'$OPTION_VALUE_1'",
    "order": 0
}'
make_api_call "PUT" "/options/$OPTION_ID_1" "$update_option_data" "Update option"

# Test 23: Create product with attributes
print_status "=== Testing Product Creation with Attributes ==="
product_data='{
    "product": {
        "name": "Test_Smartphone_'$RANDOM_SUFFIX'",
        "price": 999.99,
        "description": "A test smartphone with attributes",
        "category_id": '$CHILD_CATEGORY_ID',
        "sku": "TEST-PHONE-'$RANDOM_SUFFIX'",
        "stock_quantity": 100,
        "status": "active"
    },
    "attributes": [
        {"category_attribute_id": '$ATTRIBUTE_ID_1', "value": "'$OPTION_VALUE_1'"},
        {"category_attribute_id": '$ATTRIBUTE_ID_2', "value": "Large"}
    ]
}'
make_api_call "POST" "/products-with-attributes" "$product_data" "Create product with attributes"

# Test 24: Error handling tests
print_status "=== Testing Error Handling ==="
make_api_call "POST" "/" '{"name": ""}' "Create category with empty name (should fail)"
make_api_call "GET" "/999999" "" "Get non-existent category (should return 404)"
make_api_call "PUT" "/999999" '{"name": "test"}' "Update non-existent category (should return 404)"
make_api_call "DELETE" "/999999" "" "Delete non-existent category (should return 404)"

# Test 25: Cleanup - Delete options
print_status "=== Cleaning Up Options ==="
for option_id in "${CREATED_OPTION_IDS[@]}"; do
    if [ ! -z "$option_id" ] && [ "$option_id" != "null" ]; then
        make_api_call "DELETE" "/options/$option_id" "" "Delete option $option_id"
    fi
done

# Test 26: Cleanup - Delete attributes
print_status "=== Cleaning Up Attributes ==="
for attribute_id in "${CREATED_ATTRIBUTE_IDS[@]}"; do
    if [ ! -z "$attribute_id" ] && [ "$attribute_id" != "null" ]; then
        make_api_call "DELETE" "/attributes/$attribute_id" "" "Delete attribute $attribute_id"
    fi
done

# Test 27: Cleanup - Delete categories (in reverse order to handle dependencies)
print_status "=== Cleaning Up Categories ==="
for ((i=${#CREATED_CATEGORY_IDS[@]}-1; i>=0; i--)); do
    category_id="${CREATED_CATEGORY_IDS[$i]}"
    if [ ! -z "$category_id" ] && [ "$category_id" != "null" ]; then
        make_api_call "DELETE" "/$category_id" "" "Delete category $category_id"
    fi
done

print_success "========================================="
print_success "All category API tests completed!"
print_success "=========================================" 