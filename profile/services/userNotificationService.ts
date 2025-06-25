import UserNotification from '../models/UserNotification.js';

export const createNotification = async (userId: number, type: string, message: string) => {
      return UserNotification.create({ userId, type, message, isRead: false });
};

export const getUserNotifications = async (userId: number, onlyUnread = false) => {
      return UserNotification.findAll({ where: { userId, ...(onlyUnread ? { isRead: false } : {}) }, order: [['createdAt', 'DESC']] });
};

export const markAsRead = async (id: number) => {
      return UserNotification.update({ isRead: true }, { where: { id } });
};

export const removeNotification = async (id: number) => {
      return UserNotification.destroy({ where: { id } });
};
