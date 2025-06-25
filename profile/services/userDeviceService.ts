import UserDevice from '../models/UserDevice.js';

export const registerDevice = async (userId: number, deviceId: string, deviceType: string) => {
      return UserDevice.create({ userId, deviceId, deviceType, lastLogin: new Date() });
};

export const getUserDevices = async (userId: number) => {
      return UserDevice.findAll({ where: { userId }, order: [['lastLogin', 'DESC']] });
};

export const updateDeviceLogin = async (id: number) => {
      return UserDevice.update({ lastLogin: new Date() }, { where: { id } });
};

export const removeDevice = async (id: number) => {
      return UserDevice.destroy({ where: { id } });
};
