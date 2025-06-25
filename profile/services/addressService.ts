import { Op } from 'sequelize';
import { UserAddress } from '../models/index.js';

interface ListAddressesOptions {
  userId: string;
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
}

const listAddresses = async ({ userId, page = 1, limit = 20, filters = {} }: ListAddressesOptions) => {
  const where: any = { user_id: userId };
  if (filters.city) where.city = { [Op.iLike]: `%${filters.city}%` };
  if (filters.province) where.province = { [Op.iLike]: `%${filters.province}%` };
  if (filters.country) where.country = { [Op.iLike]: `%${filters.country}%` };
  if (filters.is_default !== undefined) where.is_default = filters.is_default === 'true' || filters.is_default === true;

  const offset = (page - 1) * limit;
  const { rows, count } = await UserAddress.findAndCountAll({
    where,
    offset,
    limit,
    order: [['is_default', 'DESC'], ['created_at', 'DESC']],
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

const createAddress = async (userId: string, data: any) => {
  if (!data.address_line) throw new Error('address_line is required');
  if (data.is_default) {
    // فقط یک آدرس پیش‌فرض
    await UserAddress.update({ is_default: false }, { where: { user_id: userId } });
  }
  return UserAddress.create({ ...data, user_id: userId });
};

const updateAddress = async (userId: string, addressId: string, data: any) => {
  if (data.is_default) {
    await UserAddress.update({ is_default: false }, { where: { user_id: userId } });
  }
  const [count, [address]] = await UserAddress.update(data, {
    where: { user_id: userId, id: addressId },
    returning: true,
  });
  return count ? address : null;
};

const deleteAddress = async (userId: string, addressId: string) => {
  const count = await UserAddress.destroy({ where: { user_id: userId, id: addressId } });
  return !!count;
};

export default {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
}; 