import Joi from 'joi';

export const productSchema = Joi.object({
      name: Joi.string().required(),
      slug: Joi.string().optional(),
      description: Joi.string().allow(''),
      price: Joi.number().required(),
      category_id: Joi.string().optional(),
      metadata: Joi.object().optional(),
      status: Joi.string().valid('active', 'inactive', 'draft', 'archived').optional(),
      attributes: Joi.array().items(
        Joi.object({
          attribute_id: Joi.string().required(),
          value: Joi.any().required()
        })
      ).optional(),
      image_ids: Joi.array().items(Joi.string()).optional(),
      img: Joi.string().optional(),
      sku: Joi.forbidden(), // کاربر نباید مقداردهی کند
});
