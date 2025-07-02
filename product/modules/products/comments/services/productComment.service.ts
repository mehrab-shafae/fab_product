import { ProductComment, IProductComment } from '../models/productComment.model';

export const addComment = async (data: Partial<IProductComment>) => {
  const comment = new ProductComment(data);
  return await comment.save();
};

export const getCommentsByProduct = async (product_id: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const comments = await ProductComment.find({ product_id, deleted_at: null })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
  const total = await ProductComment.countDocuments({ product_id, deleted_at: null });
  return { comments, total, page, limit, pages: Math.ceil(total / limit) };
};

export const deleteComment = async (id: string) => {
  return await ProductComment.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
}; 