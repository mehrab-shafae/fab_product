import { Op } from 'sequelize';
import { UserProfile } from '../models/index.js';

interface ListProfilesOptions {
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
}

const listProfiles = async ({ page = 1, limit = 20, filters = {} }: ListProfilesOptions) => {
  const where: any = {};
  if (filters.first_name) where.first_name = { [Op.iLike]: `%${filters.first_name}%` };
  if (filters.last_name) where.last_name = { [Op.iLike]: `%${filters.last_name}%` };
  if (filters.email) where.email = { [Op.iLike]: `%${filters.email}%` };
  if (filters.mobile) where.mobile = { [Op.iLike]: `%${filters.mobile}%` };
  if (filters.gender) where.gender = filters.gender;

  const offset = (page - 1) * limit;
  const { rows, count } = await UserProfile.findAndCountAll({
    where,
    offset,
    limit,
    order: [['created_at', 'DESC']],
  });
  return {
    items: rows,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
};

const getProfile = async (userId: string) => {
  return UserProfile.findOne({ where: { user_id: userId } });
};

const createProfile = async (data: any) => {
  if (!data.user_id) throw new Error('user_id is required');
  const exists = await UserProfile.findOne({ where: { user_id: data.user_id } });
  if (exists) throw { code: 'PROFILE_EXISTS', message: 'Profile already exists' };
  return UserProfile.create(data);
};

const updateProfile = async (userId: string, data: any) => {
  const [count, [profile]] = await UserProfile.update(data, {
    where: { user_id: userId },
    returning: true,
  });
  return count ? profile : null;
};

const deleteProfile = async (userId: string) => {
  const count = await UserProfile.destroy({ where: { user_id: userId } });
  return !!count;
};

export default {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
}; 