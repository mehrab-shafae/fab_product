import { Request, Response } from 'express';
import { logActivity, getUserActivities } from '../services/userActivityLogService.js';

export const create = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { action, meta } = req.body;
  if (!action) {
    return res.status(400).json({ status: 'error', message: 'action is required' });
  }
  try {
    const log = await logActivity(Number(userId), action, meta);
    res.status(201).json({ status: 'success', data: log, message: 'Activity logged' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to log activity', details: err });
  }
};

export const list = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit } = req.query;
  try {
    const logs = await getUserActivities(Number(userId), limit ? Number(limit) : 20);
    res.json({ status: 'success', data: logs, message: 'Activity logs fetched' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch activity logs', details: err });
  }
}; 