import UserSetting from '../models/UserSetting.js';

export const createSetting = async (userId: number, key: string, value: string) => {
      return UserSetting.create({ userId, key, value });
};

export const getSettings = async (userId: number) => {
      return UserSetting.findAll({ where: { userId } });
};

export const updateSetting = async (id: number, data: Partial<{ key: string; value: string }>) => {
      return UserSetting.update(data, { where: { id } });
};

export const deleteSetting = async (id: number) => {
      return UserSetting.destroy({ where: { id } });
};
