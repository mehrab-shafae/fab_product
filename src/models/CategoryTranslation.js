import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import Category from './Category.js';
import Language from './Language.js';

const CategoryTranslation = sequelize.define(
      'CategoryTranslation',
      {
            id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
            },
            category_id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  references: {
                        model: 'categories',
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
            meta_title: {
                  type: DataTypes.STRING(255),
                  allowNull: true,
            },
            meta_description: {
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
            tableName: 'category_translations',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                  {
                        unique: true,
                        fields: ['category_id', 'language_code'],
                  },
            ],
      }
);

CategoryTranslation.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
CategoryTranslation.belongsTo(Language, { foreignKey: 'language_code', targetKey: 'code', as: 'language' });

export default CategoryTranslation;
