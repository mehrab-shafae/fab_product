import Joi from 'joi';

export const productSchema = Joi.object({
      name: Joi.string().required(),
      slug: Joi.string().optional(),
      description: Joi.string().allow(''),
      brand: Joi.string().optional(),
      brand_model: Joi.string().optional(),
      category_id: Joi.string().optional(),
      metadata: Joi.object().optional(),
      meta_helper: Joi.array()
            .items(
                  Joi.object({
                        size: Joi.string().trim().required(),
                        value: Joi.array().required(),
                  })
            )
            .optional(),
      status: Joi.string().valid('active', 'inactive', 'draft', 'archived').optional(),
      image_ids: Joi.array().items(Joi.string()).optional(),
      img: Joi.string().optional(),
      variants: Joi.array()
            .items(
                  Joi.object({
                        attributes: Joi.array()
                              .items(
                                    Joi.object({
                                          attribute_id: Joi.string().required(),
                                          value: Joi.any().required(),
                                    })
                              )
                              .optional(),
                        inventory: Joi.object({
                              stock: Joi.number().min(0).default(1),
                              price: Joi.number().min(0).default(0),
                              old_price: Joi.number().min(0).default(0),
                        }).optional(),
                        image_ids: Joi.array().items(Joi.string()).max(100).optional(),
                        sku: Joi.string().optional(),
                  })
            )
            .optional(),
});
