import { DataTypes } from 'sequelize';
import sequelize from './config.js';

const Language = sequelize.define(
      'Language',
      {
            id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
            },
            code: {
                  type: DataTypes.STRING(10),
                  allowNull: false,
                  unique: true,
            },
            name: {
                  type: DataTypes.STRING(100),
                  allowNull: false,
            },
            native_name: {
                  type: DataTypes.STRING(100),
                  allowNull: false,
            },
            is_default: {
                  type: DataTypes.BOOLEAN,
                  defaultValue: false,
            },
            is_active: {
                  type: DataTypes.BOOLEAN,
                  defaultValue: true,
            },
            direction: {
                  type: DataTypes.STRING(3),
                  defaultValue: 'ltr',
            },
            created_at: {
                  type: DataTypes.DATE,
                  defaultValue: DataTypes.NOW,
            },
            updated_at: {
                  type: DataTypes.DATE,
                  defaultValue: DataTypes.NOW,
            },
      },
      {
            tableName: 'languages',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
      }
);

export default Language;
