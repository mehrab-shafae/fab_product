import { DataTypes } from 'sequelize';
import sequelize from './config.js';
import CategoryAttribute from './CategoryAttribute.js';

const CategoryAttributeOption = sequelize.define('CategoryAttributeOption', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    category_attribute_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'category_attributes',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    value: {
        type: DataTypes.STRING(255),
        allowNull: false
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
    tableName: 'category_attribute_options',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

CategoryAttributeOption.belongsTo(CategoryAttribute, { foreignKey: 'category_attribute_id', as: 'attribute' });
CategoryAttribute.hasMany(CategoryAttributeOption, { foreignKey: 'category_attribute_id', as: 'options' });

export default CategoryAttributeOption; 