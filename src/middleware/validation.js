/**
 * Middleware to validate required fields in request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Function} Express middleware function
 */
export const validateRequiredFieldsMiddleware = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = requiredFields.filter(field => {
            // Check if field exists and is not empty
            const value = req.body[field];
            return value === undefined || value === null || value === '';
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                fields: missingFields
            });
        }

        next();
    };
};

/**
 * Middleware to validate field types in request body
 * @param {Object} fieldTypes - Object mapping field names to their expected types
 * @returns {Function} Express middleware function
 */
export const validateFieldTypesMiddleware = (fieldTypes) => {
    return (req, res, next) => {
        const typeErrors = [];

        for (const [field, expectedType] of Object.entries(fieldTypes)) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];
                let isValid = true;

                switch (expectedType) {
                    case 'string':
                        isValid = typeof value === 'string';
                        break;
                    case 'number':
                        isValid = typeof value === 'number' && !isNaN(value);
                        break;
                    case 'boolean':
                        isValid = typeof value === 'boolean';
                        break;
                    case 'array':
                        isValid = Array.isArray(value);
                        break;
                    case 'object':
                        isValid = typeof value === 'object' && value !== null && !Array.isArray(value);
                        break;
                    case 'integer':
                        isValid = Number.isInteger(value);
                        break;
                    case 'date':
                        isValid = !isNaN(Date.parse(value));
                        break;
                    case 'email':
                        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                        break;
                    case 'url':
                        try {
                            new URL(value);
                            isValid = true;
                        } catch {
                            isValid = false;
                        }
                        break;
                }

                if (!isValid) {
                    typeErrors.push({
                        field,
                        expectedType,
                        actualType: typeof value
                    });
                }
            }
        }

        if (typeErrors.length > 0) {
            return res.status(400).json({
                error: 'Invalid field types',
                typeErrors
            });
        }

        next();
    };
};

/**
 * Middleware to validate field values against a set of allowed values
 * @param {Object} allowedValues - Object mapping field names to arrays of allowed values
 * @returns {Function} Express middleware function
 */
export const validateAllowedValuesMiddleware = (allowedValues) => {
    return (req, res, next) => {
        const valueErrors = [];

        for (const [field, allowed] of Object.entries(allowedValues)) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];
                if (!allowed.includes(value)) {
                    valueErrors.push({
                        field,
                        value,
                        allowedValues: allowed
                    });
                }
            }
        }

        if (valueErrors.length > 0) {
            return res.status(400).json({
                error: 'Invalid field values',
                valueErrors
            });
        }

        next();
    };
};

/**
 * Middleware to validate field lengths
 * @param {Object} lengthConstraints - Object mapping field names to their length constraints
 * @returns {Function} Express middleware function
 */
export const validateLengthMiddleware = (lengthConstraints) => {
    return (req, res, next) => {
        const lengthErrors = [];

        for (const [field, constraints] of Object.entries(lengthConstraints)) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];
                const length = value?.length;

                if (length !== undefined) {
                    if (constraints.min !== undefined && length < constraints.min) {
                        lengthErrors.push({
                            field,
                            length,
                            constraint: `minimum ${constraints.min}`
                        });
                    }
                    if (constraints.max !== undefined && length > constraints.max) {
                        lengthErrors.push({
                            field,
                            length,
                            constraint: `maximum ${constraints.max}`
                        });
                    }
                }
            }
        }

        if (lengthErrors.length > 0) {
            return res.status(400).json({
                error: 'Invalid field lengths',
                lengthErrors
            });
        }

        next();
    };
};

/**
 * Middleware to validate numeric ranges
 * @param {Object} rangeConstraints - Object mapping field names to their range constraints
 * @returns {Function} Express middleware function
 */
export const validateRangeMiddleware = (rangeConstraints) => {
    return (req, res, next) => {
        const rangeErrors = [];

        for (const [field, constraints] of Object.entries(rangeConstraints)) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];

                if (typeof value === 'number') {
                    if (constraints.min !== undefined && value < constraints.min) {
                        rangeErrors.push({
                            field,
                            value,
                            constraint: `minimum ${constraints.min}`
                        });
                    }
                    if (constraints.max !== undefined && value > constraints.max) {
                        rangeErrors.push({
                            field,
                            value,
                            constraint: `maximum ${constraints.max}`
                        });
                    }
                }
            }
        }

        if (rangeErrors.length > 0) {
            return res.status(400).json({
                error: 'Invalid numeric ranges',
                rangeErrors
            });
        }

        next();
    };
};

/**
 * Middleware to validate array contents
 * @param {Object} arrayConstraints - Object mapping field names to their array constraints
 * @returns {Function} Express middleware function
 */
export const validateArrayMiddleware = (arrayConstraints) => {
    return (req, res, next) => {
        const arrayErrors = [];

        for (const [field, constraints] of Object.entries(arrayConstraints)) {
            if (req.body[field] !== undefined) {
                const value = req.body[field];

                if (Array.isArray(value)) {
                    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
                        arrayErrors.push({
                            field,
                            length: value.length,
                            constraint: `minimum length ${constraints.minLength}`
                        });
                    }
                    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
                        arrayErrors.push({
                            field,
                            length: value.length,
                            constraint: `maximum length ${constraints.maxLength}`
                        });
                    }
                    if (constraints.unique && new Set(value).size !== value.length) {
                        arrayErrors.push({
                            field,
                            error: 'Array must contain unique values'
                        });
                    }
                }
            }
        }

        if (arrayErrors.length > 0) {
            return res.status(400).json({
                error: 'Invalid array constraints',
                arrayErrors
            });
        }

        next();
    };
}; 