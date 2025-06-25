import UserSocialLink from '../models/UserSocialLink.js';

export const createSocialLink = async (userId: number, platform: string, url: string) => {
  return UserSocialLink.create({ userId, platform, url });
};

export const getSocialLinks = async (userId: number) => {
  return UserSocialLink.findAll({ where: { userId } });
};

export const updateSocialLink = async (id: number, data: Partial<{ platform: string; url: string }>) => {
  return UserSocialLink.update(data, { where: { id } });
};

export const deleteSocialLink = async (id: number) => {
  return UserSocialLink.destroy({ where: { id } });
}; 