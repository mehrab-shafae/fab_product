import { Request, Response } from 'express';
import { addProductImage, getProductImages, deleteProductImage } from '../services/productImage.service.js';

export const addProductImageController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const image = await addProductImage(data);
            res.status(201).json({ status: 'success', data: image, message: 'Product image added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductImagesController = async (req: Request, res: Response) => {
      try {
            const images = await getProductImages(req.params.productId);
            res.json({ status: 'success', data: images });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const deleteProductImageController = async (req: Request, res: Response) => {
      try {
            const image = await deleteProductImage(req.params.imageId);
            if (!image) return res.status(404).json({ status: 'error', error: 'Image not found' });
            res.json({ status: 'success', data: image, message: 'Product image deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
