import { Language, CategoryTranslation, ProductTranslation, CategoryAttributeTranslation, CategoryAttributeOptionTranslation, CategoryAttribute, CategoryAttributeOption } from '../models/index.js';

class I18nService {
      constructor() {
            this.defaultLanguage = 'fa';
            this.supportedLanguages = ['fa', 'en', 'ar'];
            this.languageCache = new Map();
            this.translationCache = new Map();
      }

      /**
       * Get language from request headers or query parameters
       * @param {Object} req - Express request object
       * @returns {string} Language code
       */
      getLanguageFromRequest(req) {
            // Priority: query param > header > default
            const queryLang = req.query.lang || req.query.language;
            if (queryLang && this.supportedLanguages.includes(queryLang)) {
                  return queryLang;
            }

            const acceptLanguage = req.headers['accept-language'];
            if (acceptLanguage) {
                  const preferredLang = acceptLanguage.split(',')[0].split('-')[0];
                  if (this.supportedLanguages.includes(preferredLang)) {
                        return preferredLang;
                  }
            }

            return this.defaultLanguage;
      }

      /**
       * Get all active languages
       * @returns {Promise<Array>} Array of language objects
       */
      async getLanguages() {
            const cacheKey = 'all_languages';
            if (this.languageCache.has(cacheKey)) {
                  return this.languageCache.get(cacheKey);
            }

            const languages = await Language.findAll({
                  where: { is_active: true },
                  order: [
                        ['is_default', 'DESC'],
                        ['name', 'ASC'],
                  ],
            });

            this.languageCache.set(cacheKey, languages);
            return languages;
      }

      /**
       * Get default language
       * @returns {Promise<Object>} Default language object
       */
      async getDefaultLanguage() {
            const languages = await this.getLanguages();
            return languages.find(lang => lang.is_default) || languages[0];
      }

      /**
       * Get category with translations
       * @param {number} categoryId - Category ID
       * @param {string} languageCode - Language code
       * @returns {Promise<Object>} Category with translations
       */
      async getCategoryWithTranslation(categoryId, languageCode = 'fa') {
            const cacheKey = `category_${categoryId}_${languageCode}`;
            if (this.translationCache.has(cacheKey)) {
                  return this.translationCache.get(cacheKey);
            }

            const { Category } = await import('../models/index.js');

            const category = await Category.findByPk(categoryId, {
                  include: [
                        {
                              model: CategoryTranslation,
                              as: 'translations',
                              where: { language_code: languageCode },
                              required: false,
                        },
                        {
                              model: CategoryAttribute,
                              as: 'attributes',
                              include: [
                                    {
                                          model: CategoryAttributeOption,
                                          as: 'options',
                                          include: [
                                                {
                                                      model: CategoryAttributeOptionTranslation,
                                                      as: 'translations',
                                                      where: { language_code: languageCode },
                                                      required: false,
                                                },
                                          ],
                                    },
                                    {
                                          model: CategoryAttributeTranslation,
                                          as: 'translations',
                                          where: { language_code: languageCode },
                                          required: false,
                                    },
                              ],
                        },
                  ],
            });

            if (!category) return null;

            const result = this.mergeTranslations(category, languageCode);
            this.translationCache.set(cacheKey, result);
            return result;
      }

      /**
       * Get product with translations
       * @param {number} productId - Product ID
       * @param {string} languageCode - Language code
       * @returns {Promise<Object>} Product with translations
       */
      async getProductWithTranslation(productId, languageCode = 'fa') {
            const cacheKey = `product_${productId}_${languageCode}`;
            if (this.translationCache.has(cacheKey)) {
                  return this.translationCache.get(cacheKey);
            }

            const { Product } = await import('../models/index.js');

            const product = await Product.findByPk(productId, {
                  include: [
                        {
                              model: ProductTranslation,
                              as: 'translations',
                              where: { language_code: languageCode },
                              required: false,
                        },
                  ],
            });

            if (!product) return null;

            const result = this.mergeTranslations(product, languageCode);
            this.translationCache.set(cacheKey, result);
            return result;
      }

      /**
       * Merge translations with main entity
       * @param {Object} entity - Main entity (category, product, etc.)
       * @param {string} languageCode - Language code
       * @returns {Object} Entity with merged translations
       */
      mergeTranslations(entity, languageCode) {
            const result = entity.toJSON ? entity.toJSON() : { ...entity };

            // Handle category translations
            if (result.translations && result.translations.length > 0) {
                  const translation = result.translations[0];
                  result.name = translation.name || result.name;
                  result.description = translation.description || result.description;
                  result.meta_title = translation.meta_title || result.meta_title;
                  result.meta_description = translation.meta_description || result.meta_description;
            }

            // Handle product translations
            if (result.translations && result.translations.length > 0) {
                  const translation = result.translations[0];
                  result.name = translation.name || result.name;
                  result.description = translation.description || result.description;
            }

            // Handle category attributes translations
            if (result.attributes) {
                  result.attributes = result.attributes.map(attr => {
                        const attrResult = { ...attr };

                        if (attr.translations && attr.translations.length > 0) {
                              attrResult.name = attr.translations[0].name || attr.name;
                        }

                        if (attr.options) {
                              attrResult.options = attr.options.map(option => {
                                    const optionResult = { ...option };

                                    if (option.translations && option.translations.length > 0) {
                                          optionResult.value = option.translations[0].value || option.value;
                                    }

                                    delete optionResult.translations;
                                    return optionResult;
                              });
                        }

                        delete attrResult.translations;
                        return attrResult;
                  });
            }

            delete result.translations;
            return result;
      }

      /**
       * Create or update category translation
       * @param {number} categoryId - Category ID
       * @param {string} languageCode - Language code
       * @param {Object} translationData - Translation data
       * @returns {Promise<Object>} Created/updated translation
       */
      async upsertCategoryTranslation(categoryId, languageCode, translationData) {
            const [translation, created] = await CategoryTranslation.findOrCreate({
                  where: { category_id: categoryId, language_code: languageCode },
                  defaults: {
                        category_id: categoryId,
                        language_code: languageCode,
                        ...translationData,
                  },
            });

            if (!created) {
                  await translation.update(translationData);
            }

            this.clearCache(`category_${categoryId}_${languageCode}`);
            return translation;
      }

      /**
       * Create or update product translation
       * @param {number} productId - Product ID
       * @param {string} languageCode - Language code
       * @param {Object} translationData - Translation data
       * @returns {Promise<Object>} Created/updated translation
       */
      async upsertProductTranslation(productId, languageCode, translationData) {
            const [translation, created] = await ProductTranslation.findOrCreate({
                  where: { product_id: productId, language_code: languageCode },
                  defaults: {
                        product_id: productId,
                        language_code: languageCode,
                        ...translationData,
                  },
            });

            if (!created) {
                  await translation.update(translationData);
            }

            this.clearCache(`product_${productId}_${languageCode}`);
            return translation;
      }

      /**
       * Create or update category attribute translation
       * @param {number} attributeId - Attribute ID
       * @param {string} languageCode - Language code
       * @param {Object} translationData - Translation data
       * @returns {Promise<Object>} Created/updated translation
       */
      async upsertCategoryAttributeTranslation(attributeId, languageCode, translationData) {
            const [translation, created] = await CategoryAttributeTranslation.findOrCreate({
                  where: { category_attribute_id: attributeId, language_code: languageCode },
                  defaults: {
                        category_attribute_id: attributeId,
                        language_code: languageCode,
                        ...translationData,
                  },
            });

            if (!created) {
                  await translation.update(translationData);
            }

            return translation;
      }

      /**
       * Create or update category attribute option translation
       * @param {number} optionId - Option ID
       * @param {string} languageCode - Language code
       * @param {Object} translationData - Translation data
       * @returns {Promise<Object>} Created/updated translation
       */
      async upsertCategoryAttributeOptionTranslation(optionId, languageCode, translationData) {
            const [translation, created] = await CategoryAttributeOptionTranslation.findOrCreate({
                  where: { category_attribute_option_id: optionId, language_code: languageCode },
                  defaults: {
                        category_attribute_option_id: optionId,
                        language_code: languageCode,
                        ...translationData,
                  },
            });

            if (!created) {
                  await translation.update(translationData);
            }

            return translation;
      }

      /**
       * Clear cache for specific key
       * @param {string} key - Cache key to clear
       */
      clearCache(key) {
            this.translationCache.delete(key);
      }

      /**
       * Clear all caches
       */
      clearAllCaches() {
            this.languageCache.clear();
            this.translationCache.clear();
      }

      /**
       * Get translated text with fallback
       * @param {Object} entity - Entity with translations
       * @param {string} field - Field name to translate
       * @param {string} languageCode - Language code
       * @param {string} fallbackLanguage - Fallback language code
       * @returns {string} Translated text
       */
      getTranslatedText(entity, field, languageCode, fallbackLanguage = 'fa') {
            if (!entity || !entity.translations) {
                  return entity?.[field] || '';
            }

            const translation = entity.translations.find(t => t.language_code === languageCode);
            if (translation && translation[field]) {
                  return translation[field];
            }

            const fallbackTranslation = entity.translations.find(t => t.language_code === fallbackLanguage);
            if (fallbackTranslation && fallbackTranslation[field]) {
                  return fallbackTranslation[field];
            }

            return entity[field] || '';
      }
}

// Simple offline Persian-to-English transliteration utility
function persianToEnglishTransliterate(text) {
      // Only basic replacements for offline, fast, and local use
      const map = {
            'ا': 'a', 'آ': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch',
            'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's',
            'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
            'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h',
            'ی': 'y', 'ء': '', ' ': '-', '‌': '-', 'ٔ': '', 'ً': '', 'ٌ': '', 'ٍ': '', 'َ': '', 'ُ': '', 'ِ': '', 'ّ': '', 'ْ': '', 'ٰ': '',
      };
      return text.split('').map(c => map[c] !== undefined ? map[c] : c).join('').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

export { persianToEnglishTransliterate };

export const i18nService = new I18nService();
export default i18nService;
