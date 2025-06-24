import sequelize from './config.js';
import Category from './Category.js';
import CategoryAttribute from './CategoryAttribute.js';
import CategoryAttributeOption from './CategoryAttributeOption.js';
import ProductAttributeValue from './ProductAttributeValue.js';
import Product from './Product.js';
import Language from './Language.js';
import CategoryTranslation from './CategoryTranslation.js';
import ProductTranslation from './ProductTranslation.js';
import CategoryAttributeTranslation from './CategoryAttributeTranslation.js';
import CategoryAttributeOptionTranslation from './CategoryAttributeOptionTranslation.js';

// Initialize all models
const models = {
      Category,
      CategoryAttribute,
      CategoryAttributeOption,
      Product,
      ProductAttributeValue,
      Language,
      CategoryTranslation,
      ProductTranslation,
      CategoryAttributeTranslation,
      CategoryAttributeOptionTranslation,
};

// Define associations
Category.hasMany(CategoryAttribute, { foreignKey: 'category_id', as: 'attributes' });
Category.hasMany(CategoryTranslation, { foreignKey: 'category_id', as: 'translations' });

CategoryAttribute.hasMany(CategoryAttributeOption, { foreignKey: 'category_attribute_id', as: 'options' });
CategoryAttribute.hasMany(CategoryAttributeTranslation, { foreignKey: 'category_attribute_id', as: 'translations' });

CategoryAttributeOption.hasMany(CategoryAttributeOptionTranslation, { foreignKey: 'category_attribute_option_id', as: 'translations' });

Product.hasMany(ProductTranslation, { foreignKey: 'product_id', as: 'translations' });

// Export models and sequelize instance
export { 
      sequelize, 
      Category, 
      CategoryAttribute, 
      CategoryAttributeOption, 
      Product, 
      ProductAttributeValue,
      Language,
      CategoryTranslation,
      ProductTranslation,
      CategoryAttributeTranslation,
      CategoryAttributeOptionTranslation
};

export default models;
