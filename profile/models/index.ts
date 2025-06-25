import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config({ path: process.env.PROFILE_ENV_PATH || '.env' });

const POSTGRES_URI = process.env.PROFILE_POSTGRES_URI || process.env.POSTGRES_URI || 'postgres://postgres:postgres@localhost:5432/profile_db';

const sequelize = new Sequelize(POSTGRES_URI, {
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    freezeTableName: true,
  },
});

export default sequelize;

export { default as UserProfile } from './UserProfile.js';
export { default as UserAddress } from './UserAddress.js';
export { default as Favorite } from './Favorite.js';
export { default as RecentView } from './RecentView.js';
export { default as UserSocialLink } from './UserSocialLink.js';
export { default as UserSetting } from './UserSetting.js';
export { default as UserActivityLog } from './UserActivityLog.js';
export { default as UserDevice } from './UserDevice.js';
export { default as UserNotification } from './UserNotification.js';
export { default as UserBlock } from './UserBlock.js';
export { default as UserPreference } from './UserPreference.js'; 