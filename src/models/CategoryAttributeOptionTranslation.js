import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import CategoryAttributeOption from './CategoryAttributeOption.js';
import Language from './Language.js';

const CategoryAttributeOptionTranslation = sequelize.define(
      'CategoryAttributeOptionTranslation',
      {
            id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
            },
            category_attribute_option_id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  references: {
                        model: 'category_attribute_options',
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
            tableName: 'category_attribute_option_translations',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                  {
                        unique: true,
                        fields: ['category_attribute_option_id', 'language_code'],
                  },
            ],
      }
);

CategoryAttributeOptionTranslation.belongsTo(CategoryAttributeOption, { foreignKey: 'category_attribute_option_id', as: 'option' });
CategoryAttributeOptionTranslation.belongsTo(Language, { foreignKey: 'language_code', targetKey: 'code', as: 'language' });

export default CategoryAttributeOptionTranslation;
