import UserActivityLog from '../models/UserActivityLog.js';

export const logActivity = async (userId: number, action: string, meta?: object) => {
  return UserActivityLog.create({ userId, action, meta });
};

export const getUserActivities = async (userId: number, limit = 20) => {
  return UserActivityLog.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit });
}; 