import Joi from 'joi';

export const productSchema = Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(''),
      price: Joi.number().required(),
      category_id: Joi.string().optional(),
      metadata: Joi.object().optional(),
      status: Joi.string().valid('active', 'inactive', 'draft', 'archived').optional(),
});
