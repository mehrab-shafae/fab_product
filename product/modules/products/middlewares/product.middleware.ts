import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export const validateProductId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID. Must be a valid Mongo ObjectId.' });
  }
  next();
};

export const validateRequiredFields = (fields: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const missing = fields.filter(f => !req.body[f]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  next();
}; 