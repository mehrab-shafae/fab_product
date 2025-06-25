import UserBlock from '../models/UserBlock.js';

export const blockUser = async (userId: number, blockedUserId: number) => {
  return UserBlock.create({ userId, blockedUserId });
};

export const blockItem = async (userId: number, blockedItemId: number, blockedItemType: string) => {
  return UserBlock.create({ userId, blockedItemId, blockedItemType });
};

export const unblock = async (id: number) => {
  return UserBlock.destroy({ where: { id } });
};

export const getBlocks = async (userId: number) => {
  return UserBlock.findAll({ where: { userId } });
}; 