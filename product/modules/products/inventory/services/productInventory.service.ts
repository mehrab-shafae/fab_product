import { ProductInventory, IProductInventory } from '../models/productInventory.model.js';

export const upsertProductInventory = async (data: Partial<IProductInventory>) => {
      const { product_id, variant_id, location } = data;
      return await ProductInventory.findOneAndUpdate({ product_id, variant_id, location, deleted_at: null }, { ...data, updated_at: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
};

export const getProductInventory = async (product_id: string, variant_id?: string) => {
      const query: any = { product_id, deleted_at: null };
      if (variant_id) query.variant_id = variant_id;
      return await ProductInventory.find(query);
};

export const deleteProductInventory = async (id: string) => {
      return await ProductInventory.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
