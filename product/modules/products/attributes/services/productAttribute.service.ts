import { ProductAttribute, IProductAttribute } from '../models/productAttribute.model';

export const createProductAttribute = async (data: Partial<IProductAttribute>) => {
  const attribute = new ProductAttribute(data);
  return await attribute.save();
};

export const getProductAttributes = async () => {
  return await ProductAttribute.find({ deleted_at: null });
}; 