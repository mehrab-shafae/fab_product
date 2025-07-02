import { ProductVariant, IProductVariant } from '../models/productVariant.model';

export const createProductVariant = async (data: Partial<IProductVariant>) => {
  const variant = new ProductVariant(data);
  return await variant.save();
};

export const getProductVariants = async (product_id: string) => {
  return await ProductVariant.find({ product_id, deleted_at: null }).sort({ created_at: -1 });
};

export const deleteProductVariant = async (id: string) => {
  return await ProductVariant.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
}; 