#!/bin/bash

# ساخت دیتابیس تست با نام یکتا
DB_NAME="product_db_test_$(date +%Y%m%d_%H%M%S)"
psql -U postgres -c "CREATE DATABASE $DB_NAME;"

# تنظیم env
export POSTGRES_URI="postgresql://postgres:postgres@localhost:5432/$DB_NAME"
export MONGO_URI="mongodb://localhost:27017/$DB_NAME"

# اجرای پروژه (در صورت نیاز به background)
node index.js &

# کمی صبر برای بالا آمدن سرور
sleep 5

# اجرای تست
./test_api.sh

# (اختیاری) پاک کردن دیتابیس تست بعد از اتمام
# psql -U postgres -c "DROP DATABASE $DB_NAME;"