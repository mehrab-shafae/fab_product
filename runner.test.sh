#!/bin/bash

NODE_PID=""
DB_NAME=""

wait_for_port() {
    local port=$1
    local timeout=10
    local start_time=$(date +%s)

    while true; do
        if ! lsof -i :$port >/dev/null 2>&1; then
            return 0
        fi

        current_time=$(date +%s)
        if ((current_time - start_time > timeout)); then
            echo "Timeout waiting for port $port to be free"
            return 1
        fi

        sleep 0.5
    done
}

cleanup() {
    echo "Cleaning up resources..."

    if [ ! -z "$NODE_PID" ]; then
        echo "Killing Node.js process (PID: $NODE_PID)"
        kill $NODE_PID 2>/dev/null || true

        # Wait for the process to fully terminate
        while kill -0 $NODE_PID 2>/dev/null; do
            sleep 0.5
        done

        # Wait for port 3000 to be free
        wait_for_port 3000
    fi

    # if [ ! -z "$DB_NAME" ]; then
    #     echo "Dropping test database: $DB_NAME"
    #     psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    # fi
}

run_tests() {
    NODE_PID=""
    DB_NAME="product_db_test_$(date +%Y%m%d_%H%M%S)"

    trap cleanup EXIT

    echo "Starting test run with database: $DB_NAME"

    psql -U postgres -c "CREATE DATABASE $DB_NAME;"

    export POSTGRES_URI="postgresql://postgres:postgres@localhost:5432/$DB_NAME"
    export MONGO_URI="mongodb://localhost:27017/$DB_NAME"

    # Ensure port 3000 is free before starting
    wait_for_port 3000 || {
        echo "Port 3000 is still in use. Cannot start new test run."
        return 1
    }

    node index.js &
    NODE_PID=$!

    sleep 3

    ./test_api.sh

    sleep 2

    cleanup
}

for i in {1..5}; do
    echo "Running test iteration $i"
    run_tests
    sleep 1
done
