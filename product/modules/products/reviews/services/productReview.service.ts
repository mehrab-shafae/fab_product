import { ProductReview, IProductReview } from '../models/productReview.model';

export const addProductReview = async (data: Partial<IProductReview>) => {
      const review = new ProductReview(data);
      return await review.save();
};

export const getProductReviews = async (product_id: string, page = 1, limit = 10) => {
      const skip = (page - 1) * limit;
      const reviews = await ProductReview.find({ product_id, deleted_at: null }).sort({ created_at: -1 }).skip(skip).limit(limit);
      const total = await ProductReview.countDocuments({ product_id, deleted_at: null });
      return { reviews, total, page, limit, pages: Math.ceil(total / limit) };
};

export const deleteProductReview = async (id: string) => {
      return await ProductReview.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
