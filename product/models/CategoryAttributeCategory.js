import { DataTypes } from 'sequelize';
import sequelize from './config.js';

const CategoryAttributeCategory = sequelize.define(
  'CategoryAttributeCategory',
  {
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id',
      },
      onDelete: 'CASCADE',
      primaryKey: true,
    },
    category_attribute_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'category_attributes',
        key: 'id',
      },
      onDelete: 'CASCADE',
      primaryKey: true,
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
    tableName: 'category_attribute_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default CategoryAttributeCategory; 