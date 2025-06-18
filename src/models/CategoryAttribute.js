import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import Category from './Category.js';

const CategoryAttribute = sequelize.define('CategoryAttribute', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categories',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('string', 'number', 'enum'),
        allowNull: false
    },
    required: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'category_attributes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

CategoryAttribute.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(CategoryAttribute, { foreignKey: 'category_id', as: 'attributes' });

export default CategoryAttribute; 