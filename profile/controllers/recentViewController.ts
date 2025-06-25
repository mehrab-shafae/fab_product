import { Request, Response } from 'express';
import { addRecentView, getRecentViews, clearRecentViews } from '../services/recentViewService.js';

export const add = async (req: Request, res: Response) => {
  const { itemId, itemType } = req.body;
  const { userId } = req.params;
  try {
    const view = await addRecentView(Number(userId), itemId, itemType);
    res.status(201).json(view);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add recent view', details: err });
  }
};

export const list = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const views = await getRecentViews(Number(userId));
    res.json(views);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recent views', details: err });
  }
};

export const clear = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    await clearRecentViews(Number(userId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear recent views', details: err });
  }
};
