import { Sequelize } from 'sequelize';
import 'dotenv/config';

const POSTGRES_URI = process.env.POSTGRES_URI || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'product_db'}`;

const sequelize = new Sequelize(POSTGRES_URI, {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
      },
});

export default sequelize;
