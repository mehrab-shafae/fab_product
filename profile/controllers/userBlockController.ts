import { Request, Response } from 'express';
import { blockUser, blockItem, unblock, getBlocks } from '../services/userBlockService.js';

export const blockUserCtrl = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { blockedUserId } = req.body;
  if (!blockedUserId) {
    return res.status(400).json({ status: 'error', message: 'blockedUserId is required' });
  }
  try {
    const block = await blockUser(Number(userId), Number(blockedUserId));
    res.status(201).json({ status: 'success', data: block, message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to block user', details: err });
  }
};

export const blockItemCtrl = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { blockedItemId, blockedItemType } = req.body;
  if (!blockedItemId || !blockedItemType) {
    return res.status(400).json({ status: 'error', message: 'blockedItemId and blockedItemType are required' });
  }
  try {
    const block = await blockItem(Number(userId), Number(blockedItemId), blockedItemType);
    res.status(201).json({ status: 'success', data: block, message: 'Item blocked' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to block item', details: err });
  }
};

export const unblockCtrl = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await unblock(Number(id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to unblock', details: err });
  }
};

export const list = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const blocks = await getBlocks(Number(userId));
    res.json({ status: 'success', data: blocks, message: 'Blocks fetched' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch blocks', details: err });
  }
}; 