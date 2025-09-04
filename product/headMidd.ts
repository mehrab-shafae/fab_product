import { Express, NextFunction, Response, Request } from 'express';
import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { handleDatabaseError } from './headMidd.handle.js';

// const isDevelopment = process.env.NODE_ENV === 'development';

const { combine, timestamp, printf, colorize } = format;

const logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
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

const responseHandler = (_req: Request, res: Response & { success?: (data: any, message?: string) => void; error?: (error: any, statusCode?: number) => void }, next: NextFunction) => {
      res.success = (data: any, message: string = 'Success') => {
            res.json({
                  status: 'success',
                  data,
                  message,
            });
      };

      res.error = (error: any, statusCode: number = 500) => {
            if (typeof error === 'string') {
                  return res.status(Number(statusCode)).json({
                        status: 'error',
                        message: error,
                        data: null,
                  });
            }

            logger.error('response Error', { error });
            const handledError = handleDatabaseError(error);

            const genericMessages = ['Validation error', 'This record already exists', 'Referenced record does not exist', 'Required field is missing', 'Invalid value provided'];
            let message = handledError.errorBody.message;
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
                  ...(handledError.errorBody.details && { details: handledError.errorBody.details }),
            });
      };

      // Globally wrap res.json to normalize error messages coming from modules
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
            try {
                  if (body && typeof body === 'object' && body.status === 'error') {
                        // Normalize legacy shape: { status: 'error', error: '...' } -> message
                        if (typeof (body as any).error === 'string' && !(body as any).message) {
                              (body as any).message = (body as any).error;
                              delete (body as any).error;
                        }

                        const message = (body as any).message;
                        if (typeof message === 'string') {
                              // Detect Mongo duplicate key raw message and normalize
                              if (/E11000 duplicate key/i.test(message)) {
                                    const { errorBody } = handleDatabaseError({ code: 11000, message });
                                    (body as any).message = errorBody.message;
                                    if (process.env.NODE_ENV === 'development' && errorBody.details) {
                                          (body as any).details = { ...((body as any).details || {}), ...errorBody.details };
                                    }
                              }
                              // Detect common Mongoose cast errors
                              else if (/Cast to .* failed for value/i.test(message)) {
                                    const { errorBody } = handleDatabaseError({ name: 'CastError', message, path: undefined, value: undefined, kind: undefined });
                                    (body as any).message = errorBody.message;
                              }
                        }
                  }
            } catch (_e) {
                  // Fail open: if normalization fails, return original body
            }
            return originalJson(body);
      } as any;

      next();
};

export function headMiddleware(app: Express, express: any) {
      app.use(express.json());
      app.use(express.urlencoded({ limit: '1mb', extended: true }));

      app.use(requestLogger);
      app.use(errorLogger);
      app.use(responseHandler);
}

function requestLogger(req: Request, res: Response & { send: any }, next: NextFunction) {
      const start = Date.now();
      const requestId = Math.random().toString(36).substring(7);

      logger.debug('Incoming request', {
            requestId,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('user-agent'),
      });

      if (req.method !== 'GET' && req.body) {
            logger.debug('Request body', {
                  requestId,
                  body: req.body,
            });
      }

      const originalSend = res.send;
      res.send = function (body: any) {
            const responseTime = Date.now() - start;
            const statusCode = res.statusCode;

            logger.info('Request completed', {
                  requestId,
                  method: req.method,
                  url: req.originalUrl,
                  statusCode,
                  responseTime: `${responseTime}ms`,
            });

            if (statusCode >= 400) {
                  logger.error('Error response', {
                        requestId,
                        statusCode,
                        body: typeof body === 'string' ? body : JSON.stringify(body),
                  });
            }

            originalSend.call(this, body);
      };

      next();
}

// =====================[ errorLogger Enhancement ]=====================
function errorLogger(err: Error, req: Request, _res: Response, next: NextFunction) {
      const requestId = getRequestId(req);
      logger.error('Unhandled error', {
            requestId,
            error: err.message,
            stack: err.stack,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('user-agent'),
      });
      if (req.method !== 'GET' && req.body) {
            logger.debug('Request body at error', {
                  requestId,
                  body: req.body,
            });
      }
      next(err);
}

function getRequestId(req: Request & { requestId?: string }) {
      if (req.requestId) return req.requestId;
      const id = uuidv4();
      req.requestId = id;
      return id;
}

export function handleError(app: Express) {
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            logger.error('Unhandled error', {
                  error: err.message,
                  stack: err.stack,
            });
            res.status(500).json({
                  error: 'Internal server error',
                  message: process.env.NODE_ENV === 'development' ? err.message : undefined,
            });
      });
}
