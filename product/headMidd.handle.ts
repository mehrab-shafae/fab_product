/**
 * Generic fallback messages for certain error codes
 */
const GENERIC_MESSAGES = ['Duplicate key error. Resource already exists.', 'Validation failed for one or more fields.', 'Invalid data type or malformed identifier.'];

/**
 * Mapping of common MongoDB error codes and Mongoose error names to HTTP status and custom messages.
 */
interface MongoErrorConfig {
      statusCode: number;
      errorCode: string;
      defaultMessage: string;
      // Optional specific messages based on constraint or field
      constraints?: Record<string, string>;
}

const MONGO_ERROR_CONFIG: Record<string | number, MongoErrorConfig> = {
      11000: {
            statusCode: 409,
            errorCode: 'DUPLICATE_KEY',
            defaultMessage: 'Duplicate key error. Resource already exists.',
            constraints: {},
      },
      ValidationError: {
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            defaultMessage: 'Validation failed for one or more fields.',
            constraints: {},
      },
      CastError: {
            statusCode: 400,
            errorCode: 'CAST_ERROR',
            defaultMessage: 'Invalid data type or malformed identifier.',
            constraints: {},
      },
      default: {
            statusCode: 500,
            errorCode: 'INTERNAL_ERROR',
            defaultMessage: 'An internal server error occurred.',
            constraints: {},
      },
};

/**
 * Standardize database error into HTTP-friendly response.
 */
interface DbErrorResponse {
      status: 'error';
      message: string;
      data: null;
      details?: Record<string, any>;
}

/**
 * Handle MongoDB and Mongoose errors and normalize them into a consistent response.
 */
export function handleDatabaseError(error: any): { statusCode: number; errorBody: DbErrorResponse } {
      // Select config by code or name
      const key = error.code && MONGO_ERROR_CONFIG[error.code] ? error.code : error.name && MONGO_ERROR_CONFIG[error.name] ? error.name : 'default';
      const config = MONGO_ERROR_CONFIG[key];

      // Craft human-friendly message per error type
      let message = config.defaultMessage;
      let details: Record<string, any> | undefined;

      // Handle duplicate key (E11000)
      if (error.code === 11000) {
            // Prefer mongoose's parsed keyValue if available
            const keyValue = error.keyValue || {};
            const keys = Object.keys(keyValue);
            if (keys.length > 0) {
                  const field = keys[0];
                  const value = keyValue[field];
                  message = `Duplicate value for field '${field}': '${value}'`;
                  details = { field, value };
            } else if (typeof error.message === 'string') {
                  // Fallback regex parse from raw message
                  // Example: E11000 duplicate key error collection: product_db.products index: variants.sku_1 dup key: { variants.sku: "XYZ" }
                  const fieldMatch = error.message.match(/dup key:\s*\{\s*([^:]+):/);
                  const valueMatch = error.message.match(/:\s*\{[^}]*:\s*"?([^"}]+)"?\s*\}/);
                  const indexMatch = error.message.match(/index:\s*([^\s]+)\s/);
                  const field = fieldMatch ? fieldMatch[1].trim() : indexMatch ? indexMatch[1].replace(/_1$/, '') : undefined;
                  const value = valueMatch ? valueMatch[1] : undefined;
                  if (field && value) {
                        message = `Duplicate value for field '${field}': '${value}'`;
                        details = { field, value };
                  } else {
                        message = 'Duplicate key error. Resource already exists.';
                  }
            }
      }

      // Handle Mongoose ValidationError: aggregate field messages
      else if (error.name === 'ValidationError' && error.errors) {
            const fieldErrors = Object.values(error.errors as any).map((e: any) => e.message).filter(Boolean);
            if (fieldErrors.length > 0) {
                  message = fieldErrors[0];
                  details = { errors: fieldErrors };
            } else {
                  message = 'Validation failed for one or more fields.';
            }
      }

      // Handle Mongoose CastError
      else if (error.name === 'CastError') {
            const field = error.path;
            const value = error.value;
            message = `Invalid value '${value}' for field '${field}'.`;
            details = { field, value, kind: error.kind };
      }

      // Fallback: use provided detail/constraint if generic
      else if (GENERIC_MESSAGES.includes(message) && (error.detail || error.constraint)) {
            if (error.detail) {
                  message = error.detail;
            } else if (error.constraint) {
                  message = `Constraint violation: ${error.constraint}`;
            }
      }

      const errorBody: DbErrorResponse = {
            status: 'error',
            message,
            data: null,
      };

      // Include details if available or when in development
      if (details || process.env.NODE_ENV === 'development') {
            errorBody.details = {
                  ...(details || {}),
                  ...(process.env.NODE_ENV === 'development'
                        ? {
                                name: error.name,
                                code: error.code,
                                keyValue: error.keyValue,
                                errors: error.errors,
                                path: error.path,
                                kind: error.kind,
                                detail: error.detail,
                                constraint: error.constraint,
                          }
                        : {}),
            };
      }

      return { statusCode: config.statusCode, errorBody };
}
