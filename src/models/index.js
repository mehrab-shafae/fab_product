import sequelize from './config.js';
import Category from './Category.js';
import CategoryAttribute from './CategoryAttribute.js';
import CategoryAttributeOption from './CategoryAttributeOption.js';
import ProductAttributeValue from './ProductAttributeValue.js';
import Product from './Product.js';

// Initialize all models
const models = {
    Category,
    CategoryAttribute,
    CategoryAttributeOption,
    Product,
    ProductAttributeValue
};

// Define associations
Category.hasMany(CategoryAttribute, { foreignKey: 'category_id', as: 'categoryAttributes' });
CategoryAttribute.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// Export models and sequelize instance
export {
    sequelize,
    Category,
    CategoryAttribute,
    CategoryAttributeOption,
    Product,
    ProductAttributeValue
};

export default models; 