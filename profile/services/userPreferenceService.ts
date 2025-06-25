import UserPreference from '../models/UserPreference.js';

export const setPreference = async (userId: number, key: string, value: string) => {
  return UserPreference.upsert({ userId, key, value });
};

export const getPreferences = async (userId: number) => {
  return UserPreference.findAll({ where: { userId } });
};

export const removePreference = async (id: number) => {
  return UserPreference.destroy({ where: { id } });
}; 