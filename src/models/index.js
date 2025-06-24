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

// Add a seed function for languages
async function seedDefaultLanguages() {
      const defaultLanguages = [
            {
                  code: 'fa',
                  name: 'Persian',
                  native_name: 'فارسی',
                  is_default: true,
                  is_active: true,
                  direction: 'rtl',
            },
            {
                  code: 'en',
                  name: 'English',
                  native_name: 'English',
                  is_default: false,
                  is_active: true,
                  direction: 'ltr',
            },
            {
                  code: 'ar',
                  name: 'Arabic',
                  native_name: 'العربية',
                  is_default: false,
                  is_active: true,
                  direction: 'rtl',
            },
      ];
      // Ensure only one default
      await Language.update({ is_default: false }, { where: {} });
      for (const lang of defaultLanguages) {
            const [language, created] = await Language.findOrCreate({
                  where: { code: lang.code },
                  defaults: lang,
            });
            if (!created) {
                  await language.update({
                        name: lang.name,
                        native_name: lang.native_name,
                        is_active: lang.is_active,
                        direction: lang.direction,
                        is_default: lang.is_default,
                  });
            }
      }
}

// Export models and sequelize instance
export { sequelize, Category, CategoryAttribute, CategoryAttributeOption, Product, ProductAttributeValue, Language, CategoryTranslation, ProductTranslation, CategoryAttributeTranslation, CategoryAttributeOptionTranslation, seedDefaultLanguages };

export default models;
