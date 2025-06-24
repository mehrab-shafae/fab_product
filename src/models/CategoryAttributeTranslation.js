import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import CategoryAttribute from './CategoryAttribute.js';
import Language from './Language.js';

const CategoryAttributeTranslation = sequelize.define(
      'CategoryAttributeTranslation',
      {
            id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
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
            tableName: 'category_attribute_translations',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                  {
                        unique: true,
                        fields: ['category_attribute_id', 'language_code'],
                  },
            ],
      }
);

CategoryAttributeTranslation.belongsTo(CategoryAttribute, { foreignKey: 'category_attribute_id', as: 'attribute' });
CategoryAttributeTranslation.belongsTo(Language, { foreignKey: 'language_code', targetKey: 'code', as: 'language' });

export default CategoryAttributeTranslation;
