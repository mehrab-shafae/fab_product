import express from 'express';
import {
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
} from '../controllers/i18nController.js';
import { validateLanguageMiddleware } from '../middlewares/i18nMiddleware.js';

const router = express.Router();

// Language management routes
router.get('/languages', getLanguagesController);
router.get('/languages/default', getDefaultLanguageController);

// Category translation routes
router.get('/categories/:categoryId/translated', getCategoryWithTranslationController);
router.post('/categories/:categoryId/translations', upsertCategoryTranslationController);
router.put('/categories/:categoryId/translations', upsertCategoryTranslationController);
router.post('/categories/:categoryId/translations/bulk', bulkUpdateCategoryTranslationsController);

// Product translation routes
router.get('/products/:productId/translated', getProductWithTranslationController);
router.post('/products/:productId/translations', upsertProductTranslationController);
router.put('/products/:productId/translations', upsertProductTranslationController);
router.post('/products/:productId/translations/bulk', bulkUpdateProductTranslationsController);

// Category attribute translation routes
router.post('/category-attributes/:attributeId/translations', upsertCategoryAttributeTranslationController);
router.put('/category-attributes/:attributeId/translations', upsertCategoryAttributeTranslationController);

// Category attribute option translation routes
router.post('/category-attribute-options/:optionId/translations', upsertCategoryAttributeOptionTranslationController);
router.put('/category-attribute-options/:optionId/translations', upsertCategoryAttributeOptionTranslationController);

// Cache management routes
router.delete('/cache/translations', clearTranslationCacheController);

export default router; 