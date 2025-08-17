import { Request, Response } from 'express';
import { addPriceHistory, getProductPriceHistory, getProductPriceStatistics } from '../services/productPriceHistory.service.js';

export const addPriceHistoryController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId, variant_id: req.body.variant_id };
            const priceHistory = await addPriceHistory(data);
            res.status(201).json({ status: 'success', data: priceHistory, message: 'Price history added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductPriceHistoryController = async (req: Request, res: Response) => {
      try {
            const { variant_id } = req.query;
            const history = await getProductPriceHistory(req.params.productId, variant_id as string);
            res.json({ status: 'success', data: history });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getProductPriceStatisticsController = async (req: Request, res: Response) => {
      try {
            const { variant_id } = req.query;
            const stats = await getProductPriceStatistics(req.params.productId, variant_id as string);
            res.json({ status: 'success', data: stats });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
