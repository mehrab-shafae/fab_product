import { DataTypes } from 'sequelize';
import sequelize from './config.js';

const CategoryAttribute = sequelize.define(
      'CategoryAttribute',
      {
            id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
            },
            name: {
                  type: DataTypes.STRING(255),
                  allowNull: false,
            },
            type: {
                  type: DataTypes.ENUM('string', 'number', 'enum'),
                  allowNull: false,
            },
            required: {
                  type: DataTypes.BOOLEAN,
                  defaultValue: false,
            },
            order: {
                  type: DataTypes.INTEGER,
                  defaultValue: 0,
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
            tableName: 'category_attributes',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
      }
);

export default CategoryAttribute;
