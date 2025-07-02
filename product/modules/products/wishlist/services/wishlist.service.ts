import { Wishlist, IWishlist } from '../models/wishlist.model';

export const addToWishlist = async (user_id: string, product_id: string) => {
  const item = new Wishlist({ user_id, product_id });
  return await item.save();
};

export const getWishlist = async (user_id: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const items = await Wishlist.find({ user_id, deleted_at: null })
    .populate('product_id')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);
  const total = await Wishlist.countDocuments({ user_id, deleted_at: null });
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
};

export const removeFromWishlist = async (id: string) => {
  return await Wishlist.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
