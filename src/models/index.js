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
      ProductAttributeValue,
};

// Define associations
Category.hasMany(CategoryAttribute, { foreignKey: 'category_id', as: 'attributes' });
CategoryAttribute.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

CategoryAttribute.hasMany(CategoryAttributeOption, { foreignKey: 'category_attribute_id', as: 'options' });
CategoryAttributeOption.belongsTo(CategoryAttribute, { foreignKey: 'category_attribute_id', as: 'attribute' });

// Export models and sequelize instance
export { sequelize, Category, CategoryAttribute, CategoryAttributeOption, Product, ProductAttributeValue };

export default models;
