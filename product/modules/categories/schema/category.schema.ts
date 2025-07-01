import * as yup from 'yup';
import { CategoryStatus } from '../types/category.types.js';

export const createCategorySchema = yup.object({
  name: yup.string().required(),
  slug: yup.string().required(),
  parentId: yup.string().nullable(),
  level: yup.number().min(1).default(1),
  order: yup.number().default(0),
  status: yup.mixed<CategoryStatus>().oneOf(['active', 'inactive', 'pending', 'archived']).default('active'),
});

export const updateCategorySchema = yup.object({
  name: yup.string(),
  slug: yup.string(),
  parentId: yup.string().nullable(),
  level: yup.number().min(1),
  order: yup.number(),
  status: yup.mixed<CategoryStatus>().oneOf(['active', 'inactive', 'pending', 'archived']),
}); 