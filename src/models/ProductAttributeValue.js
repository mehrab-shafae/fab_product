import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import CategoryAttribute from './CategoryAttribute.js';
import Product from './Product.js';

const ProductAttributeValue = sequelize.define(
      'ProductAttributeValue',
      {
            id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
            },
            product_id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  references: {
                        model: 'products',
                        key: 'id',
                  },
                  onDelete: 'CASCADE',
            },
            category_attribute_id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  references: {
                        model: 'category_attributes',
                        key: 'id',
                  },
                  onDelete: 'CASCADE',
            },
            value: {
                  type: DataTypes.STRING(255),
                  allowNull: false,
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
            tableName: 'product_attribute_values',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
      }
);

ProductAttributeValue.belongsTo(CategoryAttribute, { foreignKey: 'category_attribute_id', as: 'attribute' });
ProductAttributeValue.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(ProductAttributeValue, { foreignKey: 'product_id', as: 'attribute_values' });

export default ProductAttributeValue;
