import { ProductTag, IProductTag } from '../models/productTag.model.js';

export const addTagToProduct = async (data: Partial<IProductTag>) => {
      const tag = new ProductTag(data);
      return await tag.save();
};

export const getTagsByProduct = async (product_id: string) => {
      return await ProductTag.find({ product_id, deleted_at: null }).sort({ created_at: -1 });
};

export const getProductsByTag = async (tag_name: string, page = 1, limit = 10) => {
      const skip = (page - 1) * limit;
      const tags = await ProductTag.find({ tag_name, deleted_at: null }).skip(skip).limit(limit).populate('product_id');
      const total = await ProductTag.countDocuments({ tag_name, deleted_at: null });
      return { tags, total, page, limit, pages: Math.ceil(total / limit) };
};

export const deleteTag = async (id: string) => {
      return await ProductTag.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
