import { i18nService } from '../services/i18nService.js';
import { Language, CategoryTranslation, ProductTranslation, CategoryAttributeTranslation, CategoryAttributeOptionTranslation } from '../models/index.js';

/**
 * Get all available languages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getLanguagesController = async (req, res) => {
      try {
            const languages = await i18nService.getLanguages();
            res.success(languages, 'Languages retrieved successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Get default language
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDefaultLanguageController = async (req, res) => {
      try {
            const defaultLanguage = await i18nService.getDefaultLanguage();
            res.success(defaultLanguage, 'Default language retrieved successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Create or update category translation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const upsertCategoryTranslationController = async (req, res) => {
      try {
            const { categoryId } = req.params;
            const { language_code, name, description, meta_title, meta_description } = req.body;

            if (!language_code || !name) {
                  return res.status(400).json({
                        error: 'Missing required fields',
                        message: 'language_code and name are required',
                  });
            }

            const translation = await i18nService.upsertCategoryTranslation(parseInt(categoryId), language_code, { name, description, meta_title, meta_description });

            res.success(translation, 'Category translation updated successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Create or update product translation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const upsertProductTranslationController = async (req, res) => {
      try {
            const { productId } = req.params;
            const { language_code, name, description } = req.body;

            if (!language_code || !name) {
                  return res.status(400).json({
                        error: 'Missing required fields',
                        message: 'language_code and name are required',
                  });
            }

            const translation = await i18nService.upsertProductTranslation(parseInt(productId), language_code, { name, description });

            res.success(translation, 'Product translation updated successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Create or update category attribute translation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const upsertCategoryAttributeTranslationController = async (req, res) => {
      try {
            const { attributeId } = req.params;
            const { language_code, name } = req.body;

            if (!language_code || !name) {
                  return res.status(400).json({
                        error: 'Missing required fields',
                        message: 'language_code and name are required',
                  });
            }

            const translation = await i18nService.upsertCategoryAttributeTranslation(parseInt(attributeId), language_code, { name });

            res.success(translation, 'Category attribute translation updated successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Create or update category attribute option translation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const upsertCategoryAttributeOptionTranslationController = async (req, res) => {
      try {
            const { optionId } = req.params;
            const { language_code, value } = req.body;

            if (!language_code || !value) {
                  return res.status(400).json({
                        error: 'Missing required fields',
                        message: 'language_code and value are required',
                  });
            }

            const translation = await i18nService.upsertCategoryAttributeOptionTranslation(parseInt(optionId), language_code, { value });

            res.success(translation, 'Category attribute option translation updated successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Get category with translations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCategoryWithTranslationController = async (req, res) => {
      try {
            const { categoryId } = req.params;
            const languageCode = req.languageCode || 'en';

            const category = await i18nService.getCategoryWithTranslation(parseInt(categoryId), languageCode);

            if (!category) {
                  return res.status(404).json({
                        error: 'Category not found',
                        message: 'Category with the specified ID does not exist',
                  });
            }

            res.success(category, 'Category with translations retrieved successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Get product with translations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getProductWithTranslationController = async (req, res) => {
      try {
            const { productId } = req.params;
            const languageCode = req.languageCode || 'en';

            const product = await i18nService.getProductWithTranslation(parseInt(productId), languageCode);

            if (!product) {
                  return res.status(404).json({
                        error: 'Product not found',
                        message: 'Product with the specified ID does not exist',
                  });
            }

            res.success(product, 'Product with translations retrieved successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Bulk update translations for a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const bulkUpdateCategoryTranslationsController = async (req, res) => {
      try {
            const { categoryId } = req.params;
            const { translations } = req.body;

            if (!translations || !Array.isArray(translations)) {
                  return res.status(400).json({
                        error: 'Invalid translations data',
                        message: 'translations must be an array',
                  });
            }

            const results = [];
            for (const translation of translations) {
                  const { language_code, ...translationData } = translation;
                  const result = await i18nService.upsertCategoryTranslation(parseInt(categoryId), language_code, translationData);
                  results.push(result);
            }

            res.success(results, 'Category translations updated successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Bulk update translations for a product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const bulkUpdateProductTranslationsController = async (req, res) => {
      try {
            const { productId } = req.params;
            const { translations } = req.body;

            if (!translations || !Array.isArray(translations)) {
                  return res.status(400).json({
                        error: 'Invalid translations data',
                        message: 'translations must be an array',
                  });
            }

            const results = [];
            for (const translation of translations) {
                  const { language_code, ...translationData } = translation;
                  const result = await i18nService.upsertProductTranslation(parseInt(productId), language_code, translationData);
                  results.push(result);
            }

            res.success(results, 'Product translations updated successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

/**
 * Clear translation cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const clearTranslationCacheController = async (req, res) => {
      try {
            i18nService.clearAllCaches();
            res.success(null, 'Translation cache cleared successfully');
      } catch (error) {
            res.status(500).json({
                  status: 'error',
                  message: error.message || 'Internal server error',
                  details: error,
            });
      }
};

export default {
      getLanguagesController,
      getDefaultLanguageController,
      upsertCategoryTranslationController,
      upsertProductTranslationController,
      upsertCategoryAttributeTranslationController,
      upsertCategoryAttributeOptionTranslationController,
      getCategoryWithTranslationController,
      getProductWithTranslationController,
      bulkUpdateCategoryTranslationsController,
      bulkUpdateProductTranslationsController,
      clearTranslationCacheController,
};
