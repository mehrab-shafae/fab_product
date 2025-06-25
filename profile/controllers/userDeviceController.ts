import { Request, Response } from 'express';
import { registerDevice, getUserDevices, updateDeviceLogin, removeDevice } from '../services/userDeviceService.js';

export const register = async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { deviceId, deviceType } = req.body;
      if (!deviceId || !deviceType) {
            return res.status(400).json({ status: 'error', message: 'deviceId and deviceType are required' });
      }
      try {
            const device = await registerDevice(Number(userId), deviceId, deviceType);
            res.status(201).json({ status: 'success', data: device, message: 'Device registered' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to register device', details: err });
      }
};

export const list = async (req: Request, res: Response) => {
      const { userId } = req.params;
      try {
            const devices = await getUserDevices(Number(userId));
            res.json({ status: 'success', data: devices, message: 'Devices fetched' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to fetch devices', details: err });
      }
};

export const updateLogin = async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
            await updateDeviceLogin(Number(id));
            res.json({ status: 'success', message: 'Device login updated' });
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to update device login', details: err });
      }
};

export const remove = async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
            await removeDevice(Number(id));
            res.status(204).send();
      } catch (err) {
            res.status(500).json({ status: 'error', message: 'Failed to remove device', details: err });
      }
};
