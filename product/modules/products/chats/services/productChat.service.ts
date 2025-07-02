import { ProductChat, IProductChat } from '../models/productChat.model.js';

export const createProductChat = async (data: Partial<IProductChat>) => {
      const chat = new ProductChat(data);
      return await chat.save();
};

export const getProductChats = async (user_id: string, page = 1, limit = 10) => {
      const skip = (page - 1) * limit;
      const chats = await ProductChat.find({ user_id, deleted_at: null }).sort({ created_at: -1 }).skip(skip).limit(limit);
      const total = await ProductChat.countDocuments({ user_id, deleted_at: null });
      return { chats, total, page, limit, pages: Math.ceil(total / limit) };
};
