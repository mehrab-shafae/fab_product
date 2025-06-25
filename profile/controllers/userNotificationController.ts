import { Request, Response } from 'express';
import { createNotification, getUserNotifications, markAsRead, removeNotification } from '../services/userNotificationService.js';

export const create = async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { type, message } = req.body;
      if (!type || !message) {
            return res.status(400).json({ status: 'error', message: 'type and message are required' });
      }
      try {
            const notification = await createNotification(Number(userId), type, message);
            res.status(201).json({ status: 'success', data: notification, message: 'Notification created' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to create notification', details: err });
      }
};

export const list = async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { onlyUnread } = req.query;
      try {
            const notifications = await getUserNotifications(Number(userId), onlyUnread === 'true');
            res.json({ status: 'success', data: notifications, message: 'Notifications fetched' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to fetch notifications', details: err });
      }
};

export const read = async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
            await markAsRead(Number(id));
            res.json({ status: 'success', message: 'Notification marked as read' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to mark as read', details: err });
      }
};

export const remove = async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
            await removeNotification(Number(id));
            res.status(204).send();
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to remove notification', details: err });
      }
};
