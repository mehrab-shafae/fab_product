import { Request, Response } from 'express';
import { getProductAnalytics, updateProductAnalytics } from '../services/productAnalytics.service.js';

export const getProductAnalyticsController = async (req: Request, res: Response) => {
      try {
            const analytics = await getProductAnalytics(req.params.productId);
            if (!analytics) return res.status(404).json({ status: 'error', error: 'Analytics not found' });
            res.json({ status: 'success', data: analytics });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const updateProductAnalyticsController = async (req: Request, res: Response) => {
      try {
            const analytics = await updateProductAnalytics(req.params.productId, req.body);
            res.json({ status: 'success', data: analytics, message: 'Analytics updated successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
