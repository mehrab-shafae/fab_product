import { i18nService } from '../services/i18nService.js';

/**
 * Middleware to detect and set language for the request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const i18nMiddleware = (req, res, next) => {
      try {
            // Get language from request
            const languageCode = i18nService.getLanguageFromRequest(req);

            // Set language in request object
            req.language = languageCode;
            req.languageCode = languageCode;

            // Add language info to response locals for templates
            res.locals.language = languageCode;

            // Add helper methods to response object
            res.getLanguage = () => languageCode;
            res.setLanguage = lang => {
                  req.language = lang;
                  req.languageCode = lang;
                  res.locals.language = lang;
            };

            next();
      } catch (error) {
            console.error('I18n middleware error:', error);
            // Fallback to default language
            req.language = 'fa';
            req.languageCode = 'fa';
            res.locals.language = 'fa';
            next();
      }
};

/**
 * Middleware to validate language parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const validateLanguageMiddleware = (req, res, next) => {
      const { lang, language } = req.query;
      const languageCode = lang || language;

      if (languageCode && !i18nService.supportedLanguages.includes(languageCode)) {
            return res.status(400).json({
                  error: 'Unsupported language',
                  message: `Language '${languageCode}' is not supported. Supported languages: ${i18nService.supportedLanguages.join(', ')}`,
                  supportedLanguages: i18nService.supportedLanguages,
            });
      }

      next();
};

/**
 * Middleware to add language information to response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const addLanguageInfoMiddleware = async (req, res, next) => {
      try {
            // Get available languages
            const languages = await i18nService.getLanguages();
            const currentLanguage = languages.find(lang => lang.code === req.languageCode);

            // Add language info to response locals only
            res.locals.languages = languages;
            res.locals.currentLanguage = currentLanguage;

            next();
      } catch (error) {
            console.error('Add language info middleware error:', error);
            next();
      }
};

/**
 * Middleware to handle translation fallback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const translationFallbackMiddleware = (req, res, next) => {
      // Add translation helper to response
      res.translate = (entity, field, fallbackLanguage = 'fa') => {
            return i18nService.getTranslatedText(entity, field, req.languageCode, fallbackLanguage);
      };

      next();
};

export default {
      i18nMiddleware,
      validateLanguageMiddleware,
      addLanguageInfoMiddleware,
      translationFallbackMiddleware,
};
