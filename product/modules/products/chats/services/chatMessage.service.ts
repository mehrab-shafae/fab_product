import { ChatMessage, IChatMessage } from '../models/chatMessage.model.js';

export const addChatMessage = async (data: Partial<IChatMessage>) => {
      const message = new ChatMessage(data);
      return await message.save();
};

export const getChatMessages = async (chat_id: string, page = 1, limit = 10) => {
      const skip = (page - 1) * limit;
      const messages = await ChatMessage.find({ chat_id, deleted_at: null }).sort({ created_at: 1 }).skip(skip).limit(limit);
      const total = await ChatMessage.countDocuments({ chat_id, deleted_at: null });
      return { messages, total, page, limit, pages: Math.ceil(total / limit) };
};

export const markChatMessagesAsRead = async (chat_id: string, user_id: string) => {
      return await ChatMessage.updateMany({ chat_id, sender_id: { $ne: user_id }, is_read: false }, { is_read: true });
};
