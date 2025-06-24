import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import Product from './Product.js';
import Language from './Language.js';

const ProductTranslation = sequelize.define(
      'ProductTranslation',
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
            language_code: {
                  type: DataTypes.STRING(10),
                  allowNull: false,
                  references: {
                        model: 'languages',
                        key: 'code',
                  },
                  onDelete: 'CASCADE',
            },
            name: {
                  type: DataTypes.STRING(255),
                  allowNull: false,
            },
            description: {
                  type: DataTypes.TEXT,
                  allowNull: true,
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
            tableName: 'product_translations',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                  {
                        unique: true,
                        fields: ['product_id', 'language_code'],
                  },
            ],
      }
);

ProductTranslation.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
ProductTranslation.belongsTo(Language, { foreignKey: 'language_code', targetKey: 'code', as: 'language' });

export default ProductTranslation;
