docker network create krakend_product-internal
docker network connect krakend_product-internal mongodb

base on: krakend-private, auth-internal
volumes needed: mongo_data, redis_data
