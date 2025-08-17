import { Request, Response } from 'express';
import { createProductVersion, getProductVersions, deleteProductVersion } from '../services/productVersion.service.js';

export const createProductVersionController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const version = await createProductVersion(data);
            res.status(201).json({ status: 'success', data: version, message: 'Product version created successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductVersionsController = async (req: Request, res: Response) => {
      try {
            const versions = await getProductVersions(req.params.productId);
            res.json({ status: 'success', data: versions });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const deleteProductVersionController = async (req: Request, res: Response) => {
      try {
            const version = await deleteProductVersion(req.params.versionId);
            if (!version) return res.status(404).json({ status: 'error', error: 'Version not found' });
            res.json({ status: 'success', data: version, message: 'Product version deleted successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
