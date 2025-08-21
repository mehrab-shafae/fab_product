// middlewares/validate.js
const { ValidationError } = require('yup');
module.exports = function validate(schemas = {}) {
      const { body, params, query } = schemas;
      return async (req, res, next) => {
            try {
                  if (body) req.body = await body.validate(req.body, { abortEarly: false, stripUnknown: true });
                  if (params) req.params = await params.validate(req.params, { abortEarly: false, stripUnknown: true });
                  if (query) req.query = await query.validate(req.query, { abortEarly: false, stripUnknown: true });
                  next();
            } catch (err) {
                  if (err instanceof ValidationError) return res.status(400).json({ message: 'Validation failed', errors: err.errors });
                  next(err);
            }
      };
};
