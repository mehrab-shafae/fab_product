import { Request, Response } from 'express';
import { createSocialLink, getSocialLinks, updateSocialLink, deleteSocialLink } from '../services/userSocialLinkService.js';

export const create = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { platform, url } = req.body;
  if (!platform || !url) {
    return res.status(400).json({ status: 'error', message: 'platform and url are required' });
  }
  try {
    const link = await createSocialLink(Number(userId), platform, url);
    res.status(201).json({ status: 'success', data: link, message: 'Social link created' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to create social link', details: err });
  }
};

export const list = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const links = await getSocialLinks(Number(userId));
    res.json({ status: 'success', data: links, message: 'Social links fetched' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch social links', details: err });
  }
};

export const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { platform, url } = req.body;
  try {
    await updateSocialLink(Number(id), { platform, url });
    res.json({ status: 'success', message: 'Social link updated' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to update social link', details: err });
  }
};

export const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await deleteSocialLink(Number(id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to delete social link', details: err });
  }
}; 