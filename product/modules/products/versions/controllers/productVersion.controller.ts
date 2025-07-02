import { Request, Response } from 'express';
import { createProductVersion, getProductVersions, deleteProductVersion } from '../services/productVersion.service';

export const createProductVersionController = async (req: Request, res: Response) => {
  try {
    const data = { ...req.body, product_id: req.params.productId };
    const version = await createProductVersion(data);
    res.status(201).json({ success: true, data: version, message: 'Product version created successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getProductVersionsController = async (req: Request, res: Response) => {
  try {
    const versions = await getProductVersions(req.params.productId);
    res.json({ success: true, data: versions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteProductVersionController = async (req: Request, res: Response) => {
  try {
    const version = await deleteProductVersion(req.params.versionId);
    if (!version) return res.status(404).json({ success: false, error: 'Version not found' });
    res.json({ success: true, data: version, message: 'Product version deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}; 