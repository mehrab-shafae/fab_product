import Favorite from '../models/Favorite.js';

export const addFavorite = async (userId: number, itemId: number, itemType: string) => {
      return Favorite.create({ userId, itemId, itemType });
};

export const removeFavorite = async (userId: number, itemId: number, itemType: string) => {
      return Favorite.destroy({ where: { userId, itemId, itemType } });
};

export const getFavorites = async (userId: number) => {
      return Favorite.findAll({ where: { userId } });
};
