#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE_URL="http://localhost:3000"
LOG_FILE="api_test_$(date +%Y%m%d_%H%M%S).log"
STATE_FILE="test_state.json"

# Initialize state file
echo "{}" >"$STATE_FILE"

# Helper functions
log() {
    local message=$1
    local color=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${color:-$NC}[$timestamp] $message${NC}"
    echo "[$timestamp] $message" >>"$LOG_FILE"
}

save_state() {
    local key=$1
    local value=$2
    local temp_file=$(mktemp)
    jq --arg key "$key" --arg value "$value" '.[$key] = $value' "$STATE_FILE" >"$temp_file"
    mv "$temp_file" "$STATE_FILE"
}

get_state() {
    local key=$1
    jq -r --arg key "$key" '.[$key] // empty' "$STATE_FILE"
}

cleanup() {
    log "Cleaning up test environment..." "$YELLOW"
    rm -f "$STATE_FILE"
    log "Cleanup completed" "$GREEN"
}

trap cleanup EXIT

# Test execution function with improved error handling and response validation
test_endpoint() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=${5:-200}
    local state_key=$6
    local jq_filter=$7
    local description=$8

    log "\n=== Testing $test_name ===" "$BLUE"
    log "Description: $description" "$YELLOW"
    log "Endpoint: $method $endpoint" "$YELLOW"

    if [ ! -z "$data" ]; then
        log "Request Data: $data" "$YELLOW"
    fi

    local response
    local status_code
    local response_body

    # Execute the request
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint")
    else
        response=$(curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\n%{http_code}" \
            "$API_BASE_URL$endpoint")
    fi

    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')

    log "Status Code: $status_code" "$YELLOW"
    log "Response: $response_body" "$YELLOW"

    # Validate status code
    if [[ $status_code -ne $expected_status ]]; then
        log "✗ Test failed: Expected status $expected_status, got $status_code" "$RED"
        return 1
    fi

    # Validate and save state if needed
    if [ ! -z "$state_key" ] && [ ! -z "$jq_filter" ]; then
        local extracted_value
        if ! extracted_value=$(echo "$response_body" | jq -r "$jq_filter" 2>/dev/null); then
            log "✗ Test failed: Invalid JSON response or jq filter" "$RED"
            return 1
        fi

        if [ -z "$extracted_value" ]; then
            log "✗ Test failed: Could not extract value using jq filter" "$RED"
            return 1
        fi

        save_state "$state_key" "$extracted_value"
        log "✓ State saved: $state_key = $extracted_value" "$GREEN"
    fi

    log "✓ Test passed" "$GREEN"
    return 0
}

# Test suite execution
run_test_suite() {
    log "Starting API Test Suite" "$BLUE"
    log "API Base URL: $API_BASE_URL" "$YELLOW"
    log "Log file: $LOG_FILE" "$YELLOW"

    # 1. System Health Check
    test_endpoint "System Health" "GET" "/health" "" 200 "" "" "Check system health status"
    [ $? -ne 0 ] && return 1

    # 2. Category Management
    # Create parent category
    test_endpoint "Create Parent Category" "POST" "/categories" \
        '{"name": "Electronics", "parent_id": null}' \
        200 "parent_category_id" ".id" \
        "Create parent category for product hierarchy"
    [ $? -ne 0 ] && return 1

    PARENT_CATEGORY_ID=$(get_state "parent_category_id")

    # Create subcategory
    test_endpoint "Create Subcategory" "POST" "/categories" \
        "{\"name\": \"Smartphones\", \"parent_id\": $PARENT_CATEGORY_ID}" \
        200 "subcategory_id" ".id" \
        "Create subcategory under parent category"
    [ $? -ne 0 ] && return 1

    # Get category tree
    test_endpoint "Get Category Tree" "GET" "/categories/tree" \
        "" 200 "" "" \
        "Retrieve complete category hierarchy"
    [ $? -ne 0 ] && return 1

    # 3. Product Management
    # Create first product
    test_endpoint "Create First Product" "POST" "/products" \
        "{
            \"name\": \"iPhone 13\",
            \"description\": \"Latest iPhone model\",
            \"price\": 999.99,
            \"category_id\": $PARENT_CATEGORY_ID,
            \"metadata\": {
                \"brand\": \"Apple\",
                \"color\": \"Midnight Blue\",
                \"storage\": \"128GB\"
            }
        }" \
        200 "first_product_id" ".id" \
        "Create first test product"
    [ $? -ne 0 ] && return 1

    FIRST_PRODUCT_ID=$(get_state "first_product_id")

    # Create second product for relationships
    test_endpoint "Create Second Product" "POST" "/products" \
        "{
            \"name\": \"Samsung Galaxy S21\",
            \"description\": \"Flagship Android phone\",
            \"price\": 899.99,
            \"category_id\": $PARENT_CATEGORY_ID,
            \"metadata\": {
                \"brand\": \"Samsung\",
                \"color\": \"Phantom Gray\",
                \"storage\": \"256GB\"
            }
        }" \
        200 "second_product_id" ".id" \
        "Create second test product for relationships"
    [ $? -ne 0 ] && return 1

    SECOND_PRODUCT_ID=$(get_state "second_product_id")

    # 4. Product Attributes
    # Create attributes
    test_endpoint "Create Processor Attribute" "POST" "/attributes" \
        '{"name": "Processor", "type": "string"}' \
        200 "processor_attribute_id" ".id" \
        "Create processor attribute type"
    [ $? -ne 0 ] && return 1

    test_endpoint "Create Screen Size Attribute" "POST" "/attributes" \
        '{"name": "Screen Size", "type": "string"}' \
        200 "screen_size_attribute_id" ".id" \
        "Create screen size attribute type"
    [ $? -ne 0 ] && return 1

    PROCESSOR_ATTR_ID=$(get_state "processor_attribute_id")
    SCREEN_SIZE_ATTR_ID=$(get_state "screen_size_attribute_id")

    # Add attributes to product
    test_endpoint "Add Processor Attribute" "POST" "/products/$FIRST_PRODUCT_ID/attributes" \
        "{\"attribute_id\": $PROCESSOR_ATTR_ID, \"value\": \"A15 Bionic\"}" \
        200 "" "" \
        "Add processor attribute to first product"
    [ $? -ne 0 ] && return 1

    test_endpoint "Add Screen Size Attribute" "POST" "/products/$FIRST_PRODUCT_ID/attributes" \
        "{\"attribute_id\": $SCREEN_SIZE_ATTR_ID, \"value\": \"6.1 inches\"}" \
        200 "" "" \
        "Add screen size attribute to first product"
    [ $? -ne 0 ] && return 1

    # 5. Product Variants
    test_endpoint "Create Product Variant" "POST" "/products/$FIRST_PRODUCT_ID/variants" \
        "{
            \"sku\": \"IP13-256-BLK\",
            \"name\": \"iPhone 13 256GB Black\",
            \"price\": 1099.99,
            \"stock_quantity\": 50,
            \"attributes\": {
                \"storage\": \"256GB\",
                \"color\": \"Black\"
            }
        }" \
        200 "variant_id" ".id" \
        "Create variant for first product"
    [ $? -ne 0 ] && return 1

    VARIANT_ID=$(get_state "variant_id")

    # 6. Product Images
    test_endpoint "Add Primary Product Image" "POST" "/products/$FIRST_PRODUCT_ID/images" \
        "{
            \"image_url\": \"https://example.com/iphone13-main.jpg\",
            \"is_primary\": true,
            \"order_index\": 1
        }" \
        200 "primary_image_id" ".id" \
        "Add primary image to first product"
    [ $? -ne 0 ] && return 1

    # 7. Price and Inventory Management
    test_endpoint "Add Price History" "POST" "/products/$FIRST_PRODUCT_ID/price-history" \
        "{
            \"variant_id\": $VARIANT_ID,
            \"price\": 1049.99,
            \"change_reason\": \"Holiday season price adjustment\"
        }" \
        200 "" "" \
        "Add price history entry for product variant"
    [ $? -ne 0 ] && return 1

    test_endpoint "Update Inventory" "POST" "/products/$FIRST_PRODUCT_ID/inventory" \
        "{
            \"variant_id\": $VARIANT_ID,
            \"quantity\": 100,
            \"reserved_quantity\": 0,
            \"location\": \"Main Warehouse\"
        }" \
        200 "" "" \
        "Update inventory for product variant"
    [ $? -ne 0 ] && return 1

    # 8. Product Relationships
    test_endpoint "Add Product Relationship" "POST" "/products/$FIRST_PRODUCT_ID/relationships" \
        "{
            \"related_product_id\": $SECOND_PRODUCT_ID,
            \"relationship_type\": \"similar\"
        }" \
        200 "" "" \
        "Add relationship between products"
    [ $? -ne 0 ] && return 1

    # 9. Product Reviews and Comments
    test_endpoint "Add Product Review" "POST" "/products/$FIRST_PRODUCT_ID/reviews" \
        '{
            "user_id": 1,
            "rating": 5,
            "review_text": "Excellent product with amazing features!",
            "is_verified": true
        }' \
        200 "review_id" ".id" \
        "Add review to first product"
    [ $? -ne 0 ] && return 1

    test_endpoint "Add Product Comment" "POST" "/products/$FIRST_PRODUCT_ID/comments" \
        '{
            "user_id": 1,
            "comment": "When will the new color variants be available?"
        }' \
        200 "comment_id" ".id" \
        "Add comment to first product"
    [ $? -ne 0 ] && return 1

    # 10. Product Tags
    test_endpoint "Add Product Tag" "POST" "/products/$FIRST_PRODUCT_ID/tags" \
        '{"tag_name": "flagship"}' \
        200 "tag_id" ".id" \
        "Add tag to first product"
    [ $? -ne 0 ] && return 1

    # 11. Product Versions
    test_endpoint "Create Product Version" "POST" "/products/$FIRST_PRODUCT_ID/versions" \
        '{
            "version_number": 2,
            "changes": {
                "price": "Updated to 1049.99",
                "description": "Updated with new features",
                "metadata": {
                    "added_colors": ["Starlight", "Pink"]
                }
            },
            "created_by": 1
        }' \
        200 "version_id" ".id" \
        "Create new version of first product"
    [ $? -ne 0 ] && return 1

    # 12. Chat System
    test_endpoint "Create Product Chat" "POST" "/products/$FIRST_PRODUCT_ID/chats" \
        '{
            "user_id": 1,
            "seller_id": 2
        }' \
        200 "chat_id" ".id" \
        "Create chat for first product"
    [ $? -ne 0 ] && return 1

    CHAT_ID=$(get_state "chat_id")

    test_endpoint "Add Chat Message" "POST" "/chats/$CHAT_ID/messages" \
        '{
            "sender_id": 1,
            "message": "Is this product available in other colors?"
        }' \
        200 "message_id" ".id" \
        "Add message to product chat"
    [ $? -ne 0 ] && return 1

    # 13. Wishlist
    test_endpoint "Add to Wishlist" "POST" "/users/1/wishlist" \
        "{\"product_id\": $FIRST_PRODUCT_ID}" \
        200 "wishlist_id" ".id" \
        "Add first product to user wishlist"
    [ $? -ne 0 ] && return 1

    # 14. Get Operations (Testing cached responses)
    log "\n=== Testing GET Operations ===" "$BLUE"

    test_endpoint "Get Product by ID" "GET" "/products/$FIRST_PRODUCT_ID" \
        "" 200 "" "" \
        "Retrieve first product details"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Product Variants" "GET" "/products/$FIRST_PRODUCT_ID/variants" \
        "" 200 "" "" \
        "Retrieve product variants"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Product Images" "GET" "/products/$FIRST_PRODUCT_ID/images" \
        "" 200 "" "" \
        "Retrieve product images"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Product Reviews" "GET" "/products/$FIRST_PRODUCT_ID/reviews" \
        "" 200 "" "" \
        "Retrieve product reviews"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Product Comments" "GET" "/products/$FIRST_PRODUCT_ID/comments" \
        "" 200 "" "" \
        "Retrieve product comments"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Product Relationships" "GET" "/products/$FIRST_PRODUCT_ID/relationships" \
        "" 200 "" "" \
        "Retrieve product relationships"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Product Versions" "GET" "/products/$FIRST_PRODUCT_ID/versions" \
        "" 200 "" "" \
        "Retrieve product versions"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get User Wishlist" "GET" "/users/1/wishlist" \
        "" 200 "" "" \
        "Retrieve user wishlist"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Chat Messages" "GET" "/chats/$CHAT_ID/messages" \
        "" 200 "" "" \
        "Retrieve chat messages"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Price History" "GET" "/products/$FIRST_PRODUCT_ID/price-history" \
        "" 200 "" "" \
        "Retrieve product price history"
    [ $? -ne 0 ] && return 1

    test_endpoint "Get Price Statistics" "GET" "/products/$FIRST_PRODUCT_ID/price-statistics" \
        "" 200 "" "" \
        "Retrieve product price statistics"
    [ $? -ne 0 ] && return 1

    # Test price trends without variant_id
    test_endpoint "Get Price Trends (No Variant)" "GET" "/products/$FIRST_PRODUCT_ID/price-trends?period=30%20days" \
        "" 200 "" "" \
        "Retrieve product price trends without variant"
    [ $? -ne 0 ] && return 1

    # Test price trends with variant_id
    test_endpoint "Get Price Trends (With Variant)" "GET" "/products/$FIRST_PRODUCT_ID/price-trends?period=30%20days&variant_id=$VARIANT_ID" \
        "" 200 "" "" \
        "Retrieve product price trends with variant"
    [ $? -ne 0 ] && return 1

    log "\n=== API Test Suite Completed Successfully ===" "$GREEN"
    return 0
}

# Check if jq is installed
if ! command -v jq &>/dev/null; then
    log "Error: jq is required but not installed. Please install jq to run the tests." "$RED"
    exit 1
fi

# Run the test suite
run_test_suite
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    log "All tests passed successfully!" "$GREEN"
else
    log "Test suite failed!" "$RED"
fi

exit $TEST_RESULT
