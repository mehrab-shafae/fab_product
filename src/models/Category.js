import { DataTypes } from 'sequelize';
import sequelize from './config.js';

const Category = sequelize.define(
      'Category',
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
            slug: {
                  type: DataTypes.STRING(255),
                  allowNull: true,
            },
            slug_redirects: {
                  type: DataTypes.JSONB,
                  defaultValue: [],
                  comment: 'Array of old slugs for redirect purposes',
            },
            description: {
                  type: DataTypes.TEXT,
                  allowNull: true,
            },
            parent_id: {
                  type: DataTypes.INTEGER,
                  allowNull: true,
                  references: {
                        model: 'categories',
                        key: 'id',
                  },
            },
            level: {
                  type: DataTypes.INTEGER,
                  defaultValue: 1,
            },
            path: {
                  type: DataTypes.ARRAY(DataTypes.INTEGER),
                  defaultValue: [],
            },
            order: {
                  type: DataTypes.INTEGER,
                  defaultValue: 0,
            },
            status: {
                  type: DataTypes.ENUM('active', 'inactive', 'hidden'),
                  defaultValue: 'active',
            },
            is_featured: {
                  type: DataTypes.BOOLEAN,
                  defaultValue: false,
            },
            image_url: {
                  type: DataTypes.STRING(500),
                  allowNull: true,
            },
            icon_url: {
                  type: DataTypes.STRING(500),
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
            meta_keywords: {
                  type: DataTypes.ARRAY(DataTypes.STRING),
                  defaultValue: [],
            },
            attributes: {
                  type: DataTypes.JSONB,
                  defaultValue: {},
            },
            attribute_metadata: {
                  type: DataTypes.JSONB,
                  defaultValue: {},
            },
            settings: {
                  type: DataTypes.JSONB,
                  defaultValue: {},
            },
            created_at: {
                  type: DataTypes.DATE,
                  defaultValue: DataTypes.NOW,
            },
            updated_at: {
                  type: DataTypes.DATE,
                  defaultValue: DataTypes.NOW,
            },
            deleted_at: {
                  type: DataTypes.DATE,
                  allowNull: true,
            },
      },
      {
            tableName: 'categories',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at',
            paranoid: true,
            indexes: [
                  {
                        name: 'categories_slug_idx',
                        fields: ['slug'],
                        unique: true,
                        where: {
                              deleted_at: null,
                        },
                  },
                  {
                        name: 'categories_name_idx',
                        fields: ['name'],
                        unique: true,
                        where: {
                              deleted_at: null,
                        },
                  },
                  {
                        name: 'categories_parent_id_idx',
                        fields: ['parent_id'],
                  },
                  {
                        name: 'categories_status_idx',
                        fields: ['status'],
                  },
                  {
                        name: 'categories_level_idx',
                        fields: ['level'],
                  },
                  {
                        name: 'categories_order_idx',
                        fields: ['order'],
                  },
            ],
      }
);

// Self-referential relationship for parent-child categories
Category.hasMany(Category, { as: 'children', foreignKey: 'parent_id' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parent_id' });

// Hooks for maintaining path and level
Category.beforeCreate(async category => {
      if (category.parent_id) {
            const parent = await Category.findByPk(category.parent_id);
            if (parent) {
                  category.level = parent.level + 1;
                  category.path = [...parent.path, parent.id];
            }
      } else {
            category.level = 1;
            category.path = [];
      }
});

Category.beforeUpdate(async category => {
      if (category.changed('parent_id')) {
            if (category.parent_id) {
                  const parent = await Category.findByPk(category.parent_id);
                  if (parent) {
                        category.level = parent.level + 1;
                        category.path = [...parent.path, parent.id];
                  }
            } else {
                  category.level = 1;
                  category.path = [];
            }
      }
});

export default Category;
