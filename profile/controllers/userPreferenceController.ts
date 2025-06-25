import { Request, Response } from 'express';
import { setPreference, getPreferences, removePreference } from '../services/userPreferenceService.js';

export const set = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ status: 'error', message: 'key and value are required' });
  }
  try {
    const pref = await setPreference(Number(userId), key, value);
    res.status(201).json({ status: 'success', data: pref, message: 'Preference set' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to set preference', details: err });
  }
};

export const list = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const prefs = await getPreferences(Number(userId));
    res.json({ status: 'success', data: prefs, message: 'Preferences fetched' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch preferences', details: err });
  }
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await removePreference(Number(id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to remove preference', details: err });
  }
}; 