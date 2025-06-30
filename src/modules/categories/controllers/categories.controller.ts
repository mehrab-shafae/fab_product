import { Request, Response } from 'express';
import { Category } from '../models/category.model.js';
import { createCategorySchema } from '../schema/category.schema.js';

export const createCategory = async (req: Request, res: Response) => {
  try {
    const validated = await createCategorySchema.validate(req.body);
    const category = await Category.create(validated);
    res.status(201).json({ status: 'success', data: category });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error instanceof Error ? error.message : error });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find();
    res.json({ status: 'success', data: categories });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : error });
  }
}; 