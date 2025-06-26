import { Sequelize } from 'sequelize';
import 'dotenv/config';

const POSTGRES_URI = process.env.POSTGRES_URI || 'postgres://postgres:postgres@localhost:5432/profile_db';

const sequelize = new Sequelize(POSTGRES_URI, {
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      define: {
            freezeTableName: true,
      },
});

export default sequelize;
