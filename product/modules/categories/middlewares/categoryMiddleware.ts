import { Request, Response, NextFunction } from 'express';
import { Category } from '../models/category.model.js';
import { createCategorySchema, updateCategorySchema, approvalSchema } from '../schema/category.schema.js';

// جلوگیری از circular reference
export const preventCircularReference = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { parentId } = req.body;
  const categoryId = req.params.id;
  if (parentId && categoryId && parentId === categoryId) {
    res.status(400).json({ status: 'error', message: 'دسته نمی‌تواند والد خودش باشد.' });
    return;
  }
  // بررسی اینکه والد، فرزند این دسته نباشد
  if (parentId && categoryId) {
    let current = await Category.findById(parentId);
    while (current) {
      if (current.parentId?.toString() === categoryId) {
        res.status(400).json({ status: 'error', message: 'ایجاد حلقه والد-فرزند مجاز نیست.' });
        return;
      }
      if (!current.parentId) break;
      current = await Category.findById(current.parentId);
    }
  }
  next();
};

// چک وجود parent
export const checkParentCategoryExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { parentId } = req.body;
  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) {
      res.status(400).json({ status: 'error', message: 'دسته والد یافت نشد.' });
      return;
    }
  }
  next();
};

// چک وجود دسته
export const checkCategoryExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) {
    res.status(404).json({ status: 'error', message: 'دسته مورد نظر یافت نشد.' });
    return;
  }
  next();
};

// اعتبارسنجی yup برای ایجاد
export const validateCreateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await createCategorySchema.validate(req.body);
    next();
  } catch (error) {
    res.status(400).json({ status: 'error', message: (error as Error).message });
  }
};

// اعتبارسنجی yup برای ویرایش
export const validateUpdateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await updateCategorySchema.validate(req.body);
    next();
  } catch (error) {
    res.status(400).json({ status: 'error', message: (error as Error).message });
  }
};

// اعتبارسنجی yup برای approval workflow
export const validateApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await approvalSchema.validate(req.body);
    next();
  } catch (error) {
    res.status(400).json({ status: 'error', message: (error as Error).message });
  }
}; 