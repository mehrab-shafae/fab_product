#!/bin/bash

NODE_PID=""

cleanup() {
    echo "Cleaning up resources..."

    if [ ! -z "$NODE_PID" ]; then
        echo "Killing Node.js process (PID: $NODE_PID)"
        kill $NODE_PID 2>/dev/null || true
    fi

    if [ ! -z "$DB_NAME" ]; then
        echo "Dropping test database: $DB_NAME"
        psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    fi
}

trap cleanup EXIT

DB_NAME="product_db_test_$(date +%Y%m%d_%H%M%S)"
psql -U postgres -c "CREATE DATABASE $DB_NAME;"

export POSTGRES_URI="postgresql://postgres:postgres@localhost:5432/$DB_NAME"
export MONGO_URI="mongodb://localhost:27017/$DB_NAME"

node index.js &
NODE_PID=$!

sleep 5

./test_api.sh

## psql -U postgres -c "DROP DATABASE $DB_NAME;"
