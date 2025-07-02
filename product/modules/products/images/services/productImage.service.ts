import { ProductImage, IProductImage } from '../models/productImage.model';

export const addProductImage = async (data: Partial<IProductImage>) => {
      const image = new ProductImage(data);
      return await image.save();
};

export const getProductImages = async (product_id: string) => {
      return await ProductImage.find({ product_id, deleted_at: null }).sort({ order_index: 1 });
};

export const deleteProductImage = async (id: string) => {
      return await ProductImage.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
