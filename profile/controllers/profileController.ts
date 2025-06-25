import { Request, Response } from 'express';
import { UserProfile } from '../models/index.js';

export const getProfile = async (req: Request, res: Response) => {
      try {
            const { userId } = req.params;
            const profile = await UserProfile.findOne({ where: { user_id: userId } });
            if (!profile) return res.status(404).json({ error: 'Profile not found' });
            res.json(profile);
      } catch (err) {
            res.status(500).json({ error: 'Server error', details: err });
      }
};

export const createProfile = async (req: Request, res: Response) => {
      try {
            const { user_id, ...rest } = req.body;
            if (!user_id) return res.status(400).json({ error: 'user_id is required' });
            const exists = await UserProfile.findOne({ where: { user_id } });
            if (exists) return res.status(409).json({ error: 'Profile already exists' });
            const profile = await UserProfile.create({ user_id, ...rest });
            res.status(201).json(profile);
      } catch (err) {
            res.status(500).json({ error: 'Server error', details: err });
      }
};

export const updateProfile = async (req: Request, res: Response) => {
      try {
            const { userId } = req.params;
            const [count, [profile]] = await UserProfile.update(req.body, {
                  where: { user_id: userId },
                  returning: true,
            });
            if (!count) return res.status(404).json({ error: 'Profile not found' });
            res.json(profile);
      } catch (err) {
            res.status(500).json({ error: 'Server error', details: err });
      }
};

export const deleteProfile = async (req: Request, res: Response) => {
      try {
            const { userId } = req.params;
            const count = await UserProfile.destroy({ where: { user_id: userId } });
            if (!count) return res.status(404).json({ error: 'Profile not found' });
            res.json({ success: true });
      } catch (err) {
            res.status(500).json({ error: 'Server error', details: err });
      }
};

export const listProfiles = async (_req: Request, res: Response) => {
      try {
            const profiles = await UserProfile.findAll();
            res.json(profiles);
      } catch (err) {
            res.status(500).json({ error: 'Server error', details: err });
      }
};
