import { Request, Response } from 'express';
import { createSetting, getSettings, updateSetting, deleteSetting } from '../services/userSettingService.js';

export const create = async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { key, value } = req.body;
      if (!key || !value) {
            return res.status(400).json({ status: 'error', message: 'key and value are required' });
      }
      try {
            const setting = await createSetting(Number(userId), key, value);
            res.status(201).json({ status: 'success', data: setting, message: 'Setting created' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to create setting', details: err });
      }
};

export const list = async (req: Request, res: Response) => {
      const { userId } = req.params;
      try {
            const settings = await getSettings(Number(userId));
            res.json({ status: 'success', data: settings, message: 'Settings fetched' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to fetch settings', details: err });
      }
};

export const update = async (req: Request, res: Response) => {
      const { id } = req.params;
      const { key, value } = req.body;
      try {
            await updateSetting(Number(id), { key, value });
            res.json({ status: 'success', message: 'Setting updated' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to update setting', details: err });
      }
};

export const remove = async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
            await deleteSetting(Number(id));
            res.status(204).send();
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to delete setting', details: err });
      }
};
