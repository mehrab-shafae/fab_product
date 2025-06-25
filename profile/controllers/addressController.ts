import { Request, Response } from 'express';
import addressService from '../services/addressService.js';

export const listAddresses = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, ...filters } = req.query;
    const result = await addressService.listAddresses({
      userId,
      page: Number(page),
      limit: Number(limit),
      filters,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err });
  }
};

export const createAddress = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const address = await addressService.createAddress(userId, req.body);
    res.status(201).json(address);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid input', details: err });
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  try {
    const { userId, addressId } = req.params;
    const address = await addressService.updateAddress(userId, addressId, req.body);
    if (!address) return res.status(404).json({ error: 'Address not found' });
    res.json(address);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid input', details: err });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const { userId, addressId } = req.params;
    const deleted = await addressService.deleteAddress(userId, addressId);
    if (!deleted) return res.status(404).json({ error: 'Address not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err });
  }
}; 