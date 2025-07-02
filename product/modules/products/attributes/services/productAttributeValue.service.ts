import { ProductAttributeValue, IProductAttributeValue } from '../models/productAttributeValue.model';

export const addProductAttributeValue = async (data: Partial<IProductAttributeValue>) => {
  const value = new ProductAttributeValue(data);
  return await value.save();
};

export const getProductAttributeValues = async (product_id: string) => {
  return await ProductAttributeValue.find({ product_id, deleted_at: null });
}; 