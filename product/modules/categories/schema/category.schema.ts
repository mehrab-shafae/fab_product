import * as yup from 'yup';
import { CategoryStatus } from '../types/category.types.js';

export const createCategorySchema = yup.object({
      name: yup.string().required('نام دسته‌بندی الزامی است'),
      slug: yup.string().optional(),
      parentId: yup.string().nullable(),
      level: yup.number().min(1).default(1),
      order: yup.number().default(0),
      status: yup.mixed<CategoryStatus>().oneOf(['active', 'inactive', 'pending', 'archived']).default('active'),
      is_featured: yup.boolean().default(false),
      img: yup.string().optional(),
      image_ids: yup.array().of(yup.string()).optional(),
      meta_keywords: yup.array().of(yup.string()).optional(),
      meta_title: yup.string().optional(),
      meta_description: yup.string().optional(),
      attribute_metadata: yup
            .array()
            .of(
                  yup.object({
                        name: yup.string().required(),
                        type: yup.mixed<'string' | 'number' | 'enum'>().oneOf(['string', 'number', 'enum']).required(),
                        required: yup.boolean().optional(),
                        order: yup.number().optional(),
                        options: yup
                              .array()
                              .of(
                                    yup.object({
                                          value: yup.string().required(),
                                          order: yup.number().optional(),
                                    })
                              )
                              .optional(),
                  })
            )
            .optional(),
    categorySku: yup.number().notRequired().strip(), // فقط خواندنی
    baseSku: yup.number().notRequired().strip(), // فقط خواندنی
});

export const updateCategorySchema = yup.object({
      name: yup.string(),
      slug: yup.string(),
      parentId: yup.string().nullable(),
      level: yup.number().min(1),
      order: yup.number(),
      status: yup.mixed<CategoryStatus>().oneOf(['active', 'inactive', 'pending', 'archived']),
      is_featured: yup.boolean(),
      img: yup.string().optional(),
      image_ids: yup.array().of(yup.string()).optional(),
      meta_keywords: yup.array().of(yup.string()).optional(),
      meta_title: yup.string().optional(),
      meta_description: yup.string().optional(),
      attribute_metadata: yup
            .array()
            .of(
                  yup.object({
                        name: yup.string().required(),
                        type: yup.mixed<'string' | 'number' | 'enum'>().oneOf(['string', 'number', 'enum']).required(),
                        required: yup.boolean().optional(),
                        order: yup.number().optional(),
                        options: yup
                              .array()
                              .of(
                                    yup.object({
                                          value: yup.string().required(),
                                          order: yup.number().optional(),
                                    })
                              )
                              .optional(),
                  })
            )
            .optional(),
});

export const approvalSchema = yup.object({
      submittedBy: yup.string(),
      approvedBy: yup.string(),
      rejectedBy: yup.string(),
      rejectionReason: yup.string().when('rejectedBy', ([rejectedBy], schema) => (rejectedBy && rejectedBy.length > 0 ? schema.required('دلیل رد کردن الزامی است') : schema.optional())),
});
