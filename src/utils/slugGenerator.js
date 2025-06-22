import slugify from 'slugify';

// Configuration constants
const SLUG_CONFIG = {
      MAX_LENGTH: 100,
      MIN_LENGTH: 3,
      ALLOWED_CHARS: /[a-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-]/g,
      REMOVE_CHARS: /[*+~.()'"!:@#$%^&*()_+=<>?{}[\]\\|`~]/g,
      PERSIAN_NUMBERS: {
            '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
            '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
      }
};

/**
 * Convert Persian numbers to English
 */
const convertPersianNumbers = (text) => {
      return text.replace(/[۰-۹]/g, (match) => SLUG_CONFIG.PERSIAN_NUMBERS[match]);
};

/**
 * Clean and normalize text for slug generation
 */
const normalizeText = (text) => {
      if (!text || typeof text !== 'string') {
            throw new Error('Text must be a non-empty string');
      }

      // Convert Persian numbers to English
      let normalized = convertPersianNumbers(text);

      // Remove extra spaces and trim
      normalized = normalized.replace(/\s+/g, ' ').trim();

      // Convert to lowercase
      normalized = normalized.toLowerCase();

      return normalized;
};

/**
 * Validate slug format and length
 */
const validateSlug = (slug) => {
      if (!slug || typeof slug !== 'string') {
            throw new Error('Slug must be a non-empty string');
      }

      if (slug.length < SLUG_CONFIG.MIN_LENGTH) {
            throw new Error(`Slug must be at least ${SLUG_CONFIG.MIN_LENGTH} characters long`);
      }

      if (slug.length > SLUG_CONFIG.MAX_LENGTH) {
            throw new Error(`Slug must not exceed ${SLUG_CONFIG.MAX_LENGTH} characters`);
      }

      // Check for valid characters
      const invalidChars = slug.match(/[^a-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-]/g);
      if (invalidChars) {
            throw new Error(`Slug contains invalid characters: ${invalidChars.join(', ')}`);
      }

      // Check for consecutive hyphens
      if (slug.includes('--')) {
            throw new Error('Slug cannot contain consecutive hyphens');
      }

      // Check for leading/trailing hyphens
      if (slug.startsWith('-') || slug.endsWith('-')) {
            throw new Error('Slug cannot start or end with hyphens');
      }

      return true;
};

/**
 * Generate a base slug from text
 */
export const generateSlug = (text, existingSlugs = []) => {
      try {
            const normalizedText = normalizeText(text);
            
            // Generate base slug using slugify with Persian support
            let baseSlug = slugify(normalizedText, {
                  lower: true,
                  strict: true,
                  locale: 'fa',
                  remove: SLUG_CONFIG.REMOVE_CHARS,
            });

            // Clean up the slug
            baseSlug = baseSlug
                  .replace(/[^a-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-]/g, '')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');

            // Truncate if too long
            if (baseSlug.length > SLUG_CONFIG.MAX_LENGTH) {
                  baseSlug = baseSlug.substring(0, SLUG_CONFIG.MAX_LENGTH).replace(/-+$/, '');
            }

            // Ensure minimum length
            if (baseSlug.length < SLUG_CONFIG.MIN_LENGTH) {
                  baseSlug = `slug-${baseSlug}`;
            }

            // Validate the generated slug
            validateSlug(baseSlug);

            // If the slug already exists, append a number
            let finalSlug = baseSlug;
            let counter = 1;

            while (existingSlugs.includes(finalSlug)) {
                  const suffix = `-${counter}`;
                  const maxBaseLength = SLUG_CONFIG.MAX_LENGTH - suffix.length;
                  
                  if (baseSlug.length > maxBaseLength) {
                        baseSlug = baseSlug.substring(0, maxBaseLength).replace(/-+$/, '');
                  }
                  
                  finalSlug = `${baseSlug}${suffix}`;
                  counter++;
                  
                  // Prevent infinite loop
                  if (counter > 1000) {
                        throw new Error('Unable to generate unique slug after 1000 attempts');
                  }
            }

            return finalSlug;
      } catch (error) {
            throw new Error(`Failed to generate slug: ${error.message}`);
      }
};

/**
 * Generate a category slug with parent hierarchy
 */
export const generateCategorySlug = async (name, parentSlug = null, Category) => {
      try {
            // Get existing slugs more efficiently
            const existingCategories = await Category.findAll({
                  attributes: ['slug'],
                  where: {
                        deleted_at: null,
                  },
                  raw: true,
            });
            
            const existingSlugs = existingCategories.map(cat => cat.slug).filter(Boolean);

            // Generate base slug
            let baseSlug = generateSlug(name, existingSlugs);

            // If there's a parent, prepend its slug
            if (parentSlug) {
                  const parentSlugClean = parentSlug.replace(/\/$/, ''); // Remove trailing slash
                  baseSlug = `${parentSlugClean}/${baseSlug}`;
                  
                  // Check if the full path slug already exists
                  if (existingSlugs.includes(baseSlug)) {
                        let counter = 1;
                        let finalSlug = baseSlug;
                        
                        while (existingSlugs.includes(finalSlug)) {
                              finalSlug = `${baseSlug}-${counter}`;
                              counter++;
                              
                              if (counter > 1000) {
                                    throw new Error('Unable to generate unique category slug after 1000 attempts');
                              }
                        }
                        baseSlug = finalSlug;
                  }
            }

            return baseSlug;
      } catch (error) {
            throw new Error(`Failed to generate category slug: ${error.message}`);
      }
};

/**
 * Generate a custom slug with validation
 */
export const generateCustomSlug = (customSlug, existingSlugs = []) => {
      try {
            const normalizedSlug = normalizeText(customSlug);
            
            // Clean the custom slug
            let cleanSlug = normalizedSlug
                  .replace(/[^a-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-]/g, '')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');

            // Truncate if too long
            if (cleanSlug.length > SLUG_CONFIG.MAX_LENGTH) {
                  cleanSlug = cleanSlug.substring(0, SLUG_CONFIG.MAX_LENGTH).replace(/-+$/, '');
            }

            // Validate the custom slug
            validateSlug(cleanSlug);

            // Check for uniqueness
            if (existingSlugs.includes(cleanSlug)) {
                  throw new Error('Custom slug already exists');
            }

            return cleanSlug;
      } catch (error) {
            throw new Error(`Failed to generate custom slug: ${error.message}`);
      }
};

/**
 * Validate if a slug is valid
 */
export const isValidSlug = (slug) => {
      try {
            validateSlug(slug);
            return true;
      } catch (error) {
            return false;
      }
};

/**
 * Get slug configuration
 */
export const getSlugConfig = () => {
      return { ...SLUG_CONFIG };
};
