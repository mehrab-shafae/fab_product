import 'dotenv/config';
import '../cwd.js';
import express from 'express';
import { Pool } from 'pg';
import adminRoutes from './adminRoutes.js';
import { createLogger, transports, format } from 'winston';

const { combine, timestamp, printf, colorize } = format;

const PORT = 7002;

const logger = createLogger({
      level: 'info',
      format: combine(
            timestamp(),
            printf(({ level, message, timestamp, requestId, ...metadata }) => {
                  let msg = `${timestamp} [${level}]`;
                  if (requestId) msg += ` [${requestId}]`;
                  msg += ` : ${message}`;
                  if (Object.keys(metadata).length > 0) {
                        msg += JSON.stringify(metadata);
                  }
                  return msg;
            })
      ),
      transports: [
            new transports.Console({
                  format: combine(
                        colorize(),
                        timestamp(),
                        printf(({ level, message, timestamp, requestId, ...metadata }) => {
                              let msg = `${timestamp} [${level}]`;
                              if (requestId) msg += ` [${requestId}]`;
                              msg += ` : ${message}`;
                              if (Object.keys(metadata).length > 0) {
                                    msg += JSON.stringify(metadata);
                              }
                              return msg;
                        })
                  ),
            }),
            new transports.File({
                  filename: 'error.log',
                  level: 'error',
                  format: combine(
                        timestamp(),
                        printf(({ level, message, timestamp, requestId, ...metadata }) => {
                              let msg = `${timestamp} [${level}]`;
                              if (requestId) msg += ` [${requestId}]`;
                              msg += ` : ${message}`;
                              if (Object.keys(metadata).length > 0) {
                                    msg += JSON.stringify(metadata);
                              }
                              return msg;
                        })
                  ),
            }),
            new transports.File({
                  filename: 'combined.log',
                  format: combine(
                        timestamp(),
                        printf(({ level, message, timestamp, requestId, ...metadata }) => {
                              let msg = `${timestamp} [${level}]`;
                              if (requestId) msg += ` [${requestId}]`;
                              msg += ` : ${message}`;
                              if (Object.keys(metadata).length > 0) {
                                    msg += JSON.stringify(metadata);
                              }
                              return msg;
                        })
                  ),
            }),
      ],
});

const app = express();

const POSTGRES_URI = process.env.POSTGRES_URI || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'postgres'}`;

const pgPool = new Pool({
      connectionString: POSTGRES_URI,
});

function free() {
      pgPool.end();
      process.exit(0);
}

const responseHandler = (req: any, res: any, next: any) => {
      res.success = (data: any, message = 'Success') => {
            // اگر اطلاعات زبان در res.locals وجود داشت، به خروجی اضافه کن
            if (res.locals.languages && res.locals.currentLanguage) {
                  res.json({
                        status: 'success',
                        data,
                        message,
                        language: {
                              code: req.languageCode,
                              name: res.locals.currentLanguage?.name,
                              native_name: res.locals.currentLanguage?.native_name,
                              direction: res.locals.currentLanguage?.direction,
                        },
                        availableLanguages: res.locals.languages.map((lang: any) => ({
                              code: lang.code,
                              name: lang.name,
                              native_name: lang.native_name,
                              is_default: lang.is_default,
                              direction: lang.direction,
                        })),
                  });
            } else {
                  res.json({
                        status: 'success',
                        data,
                        message,
                  });
            }
      };

      res.error = (error: any, statusCode = 500) => {
            if (typeof error === 'string') {
                  return res.status(statusCode).json({
                        status: 'error',
                        message: error,
                        data: null,
                  });
            }

            logger.error('response Error', { error });
            const handledError = handleDatabaseError(error);

            // اگر پیام خطا کلی بود، پیام اختصاصی constraint را جایگزین کن
            const genericMessages = ['Validation error', 'This record already exists', 'Referenced record does not exist', 'Required field is missing', 'Invalid value provided'];
            let message = handledError.message;
            if (genericMessages.includes(message) && error.detail) {
                  // اگر دیتیل خطا وجود دارد، آن را نمایش بده
                  message = error.detail;
            } else if (genericMessages.includes(message) && error.constraint) {
                  // اگر constraint وجود دارد، پیام اختصاصی constraint را نمایش بده
                  message = `Constraint violation: ${error.constraint}`;
            }

            res.status(handledError.statusCode).json({
                  status: 'error',
                  message,
                  data: null,
                  ...(handledError.details && { details: handledError.details }),
            });
      };

      next();
};


const DB_ERROR_CODES = {
      23503: {
            categories: {
                  parent_id_fkey: 'The specified parent category does not exist',
                  default: 'Referenced record does not exist',
            },
            products: {
                  category_id_fkey: 'The specified category does not exist',
                  default: 'Referenced record does not exist',
            },
            default: 'Referenced record does not exist',
      },

      23505: {
            categories: {
                  categories_name_key: 'A category with this name already exists',
                  default: 'This record already exists',
            },
            products: {
                  products_sku_key: 'A product with this SKU already exists',
                  default: 'This record already exists',
            },
            default: 'This record already exists',
      },

      23502: {
            categories: {
                  name: 'Category name is required',
                  default: 'Required field is missing',
            },
            products: {
                  name: 'Product name is required',
                  price: 'Product price is required',
                  default: 'Required field is missing',
            },
            default: 'Required field is missing',
      },

      23514: {
            products: {
                  products_price_check: 'Product price must be greater than 0',
                  default: 'Invalid value provided',
            },
            default: 'Invalid value provided',
      },
};

function handleDatabaseError(error: any) {
      const code = String(error.code);
      if (!code || !(DB_ERROR_CODES as any)[code]) {
            return {
                  message: error.message,
                  statusCode: 500,
                  details: error.detail || undefined,
            };
      }
      const errorConfig = (DB_ERROR_CODES as any)[code];
      let message = errorConfig.default;
      let statusCode = 400;
      let errorCode = code;
      if (error.table && errorConfig[error.table]) {
            if (error.constraint && errorConfig[error.table][error.constraint]) {
                  message = errorConfig[error.table][error.constraint];
            } else if (errorConfig[error.table].default) {
                  message = errorConfig[error.table].default;
            }
      }
      switch (code) {
            case '23503':
                  statusCode = 404;
                  break;
            case '23505':
                  statusCode = 409;
                  break;
            case '23502':
            case '23514':
                  statusCode = 400;
                  break;
            default:
                  statusCode = 500;
      }
      return {
            message,
            statusCode,
            errorCode,
            details:
                  process.env.NODE_ENV === 'development'
                        ? {
                                code: error.code,
                                table: error.table,
                                constraint: error.constraint,
                          }
                        : undefined,
      };
}

function main() {
      try {
      app.locals.pgPool = pgPool;

      app.use(responseHandler);
      app.use('/', adminRoutes);

      app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            logger.error('Unhandled error', {
                  error: err.message,
                  stack: err.stack,
            });
            res.status(500).json({
                  error: 'Internal server error',
            });
      });

      app.listen(PORT, function () {
            console.log(`Database Admin Panel available at http://localhost:${PORT}`);
      });

      } catch (err) {
            console.error('Failed to start admin panel:', err);
            process.exit(1);
      }
}

main();

process.on('SIGINT', free);
process.on('SIGTERM', free);
process.on('SIGQUIT', free);
