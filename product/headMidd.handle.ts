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

      // Determine base message
      let message = config.defaultMessage;

      // Override generic message if detail or constraint provided
      if (GENERIC_MESSAGES.includes(message) && (error.detail || error.constraint)) {
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

      // Add details in development
      if (process.env.NODE_ENV === 'development') {
            errorBody.details = {
                  name: error.name,
                  code: error.code,
                  keyValue: error.keyValue,
                  errors: error.errors,
                  path: error.path,
                  kind: error.kind,
                  detail: error.detail,
                  constraint: error.constraint,
            };
      }

      return { statusCode: config.statusCode, errorBody };
}
