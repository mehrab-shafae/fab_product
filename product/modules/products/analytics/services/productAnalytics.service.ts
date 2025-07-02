import { ProductAnalytics, IProductAnalytics } from '../models/productAnalytics.model';

export const getProductAnalytics = async (product_id: string) => {
  return await ProductAnalytics.findOne({ product_id });
};

export const updateProductAnalytics = async (product_id: string, data: Partial<IProductAnalytics>) => {
  return await ProductAnalytics.findOneAndUpdate(
    { product_id },
    { ...data, updated_at: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}; 