import { ProductPriceHistory, IProductPriceHistory } from '../models/productPriceHistory.model.js';
import mongoose from 'mongoose';

export const addPriceHistory = async (data: Partial<IProductPriceHistory>) => {
      const priceHistory = new ProductPriceHistory(data);
      return await priceHistory.save();
};

export const getProductPriceHistory = async (product_id: string, variant_id?: string) => {
      const query: any = { product_id: new mongoose.Types.ObjectId(product_id), deleted_at: null };
      if (variant_id) query.variant_id = new mongoose.Types.ObjectId(variant_id);
      return await ProductPriceHistory.find(query).sort({ effective_date: -1 });
};

export const getProductPriceStatistics = async (product_id: string, variant_id?: string) => {
      const match: any = { product_id: new mongoose.Types.ObjectId(product_id), deleted_at: null };
      if (variant_id) match.variant_id = new mongoose.Types.ObjectId(variant_id);
      const stats = await ProductPriceHistory.aggregate([
            { $match: match },
            {
                  $group: {
                        _id: null,
                        min_price: { $min: '$price' },
                        max_price: { $max: '$price' },
                        avg_price: { $avg: '$price' },
                        count: { $sum: 1 },
                  },
            },
      ]);
      return stats[0] || {};
};
