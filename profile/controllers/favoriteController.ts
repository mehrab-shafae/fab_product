import { Request, Response } from 'express';
import { addFavorite, removeFavorite, getFavorites } from '../services/favoriteService.js';

export const add = async (req: Request, res: Response) => {
  const { itemId, itemType } = req.body;
  const { userId } = req.params;
  if (!itemId || !itemType) {
    return res.status(400).json({ status: 'error', message: 'itemId and itemType are required' });
  }
  try {
    const favorite = await addFavorite(Number(userId), Number(itemId), itemType);
    res.status(201).json({ status: 'success', data: favorite, message: 'Favorite added successfully' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to add favorite', details: err });
  }
};

export const remove = async (req: Request, res: Response) => {
  const { userId, itemId } = req.params;
  const { itemType } = req.query;
  if (!itemId || !itemType) {
    return res.status(400).json({ status: 'error', message: 'itemId and itemType are required' });
  }
  try {
    await removeFavorite(Number(userId), Number(itemId), String(itemType));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to remove favorite', details: err });
  }
};

export const list = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const favorites = await getFavorites(Number(userId));
    res.json({ status: 'success', data: favorites, message: 'Favorites fetched successfully' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to get favorites', details: err });
  }
}; 