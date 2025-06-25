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