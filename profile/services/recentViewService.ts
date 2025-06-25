import RecentView from '../models/RecentView.js';

export const addRecentView = async (userId: number, itemId: number, itemType: string) => {
  return RecentView.create({ userId, itemId, itemType });
};

export const getRecentViews = async (userId: number, limit = 20) => {
  return RecentView.findAll({
    where: { userId },
    order: [['viewedAt', 'DESC']],
    limit,
  });
};

export const clearRecentViews = async (userId: number) => {
  return RecentView.destroy({ where: { userId } });
}; 