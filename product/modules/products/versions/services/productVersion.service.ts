import { ProductVersion, IProductVersion } from '../models/productVersion.model';

export const createProductVersion = async (data: Partial<IProductVersion>) => {
      const version = new ProductVersion(data);
      return await version.save();
};

export const getProductVersions = async (product_id: string) => {
      return await ProductVersion.find({ product_id, deleted_at: null }).sort({ version_number: -1 });
};

export const deleteProductVersion = async (id: string) => {
      return await ProductVersion.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
