import { Product, IProduct } from '../models/product.model';

export const createProduct = async (data: Partial<IProduct>) => {
  const product = new Product(data);
  return await product.save();
};

export const getProductById = async (id: string) => {
  return await Product.findById(id);
};

export const updateProduct = async (id: string, data: Partial<IProduct>) => {
  return await Product.findByIdAndUpdate(id, data, { new: true });
};

export const deleteProduct = async (id: string) => {
  return await Product.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
}; 