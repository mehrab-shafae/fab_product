import { Request, Response } from 'express';
import { addChatMessage, getChatMessages, markChatMessagesAsRead } from '../services/chatMessage.service.js';

export const addChatMessageController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, chat_id: req.params.chatId };
            const message = await addChatMessage(data);
            res.status(201).json({ status: 'success', data: message, message: 'Chat message added successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getChatMessagesController = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getChatMessages(req.params.chatId, Number(page), Number(limit));
            res.json({ status: 'success', ...result });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const markChatMessagesAsReadController = async (req: Request, res: Response) => {
      try {
            await markChatMessagesAsRead(req.params.chatId, req.body.user_id);
            res.json({ status: 'success', message: 'Chat messages marked as read successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
