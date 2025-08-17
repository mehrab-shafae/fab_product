import { Request, Response } from 'express';
import { createProductChat, getProductChats } from '../services/productChat.service.js';

export const createProductChatController = async (req: Request, res: Response) => {
      try {
            const data = { ...req.body, product_id: req.params.productId };
            const chat = await createProductChat(data);
            res.status(201).json({ status: 'success', data: chat, message: 'Product chat created successfully' });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};

export const getUserChatsController = async (req: Request, res: Response) => {
      try {
            const { page = 1, limit = 10 } = req.query;
            const result = await getProductChats(req.params.userId, Number(page), Number(limit));
            res.json({ status: 'success', ...result });
      } catch (error: any) {
            res.status(400).json({ status: 'error', error: error.message });
      }
};
