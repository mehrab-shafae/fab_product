import { Request, Response } from 'express';
import { Product } from '../models/product.model';

export const createProduct = async (req: Request, res: Response) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product, message: 'Product updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { deleted_at: new Date() }, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}; 