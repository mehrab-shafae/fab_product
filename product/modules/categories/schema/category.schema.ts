import * as yup from 'yup';
import { CategoryStatus, ApprovalStatus } from '../types/category.types.js';

export const createCategorySchema = yup.object({
  name: yup.string().required('نام دسته‌بندی الزامی است'),
  slug: yup.string().optional(),
  parentId: yup.string().nullable(),
  level: yup.number().min(1).default(1),
  order: yup.number().default(0),
  status: yup.mixed<CategoryStatus>().oneOf(['active', 'inactive', 'pending', 'archived']).default('active'),
  is_featured: yup.boolean().default(false),
});

export const updateCategorySchema = yup.object({
  name: yup.string(),
  slug: yup.string(),
  parentId: yup.string().nullable(),
  level: yup.number().min(1),
  order: yup.number(),
  status: yup.mixed<CategoryStatus>().oneOf(['active', 'inactive', 'pending', 'archived']),
  is_featured: yup.boolean(),
});

export const approvalSchema = yup.object({
  submittedBy: yup.string(),
  approvedBy: yup.string(),
  rejectedBy: yup.string(),
  rejectionReason: yup.string().when('rejectedBy', {
    is: (val: string) => val && val.length > 0,
    then: yup.string().required('دلیل رد کردن الزامی است'),
    otherwise: yup.string().optional(),
  }),
}); 