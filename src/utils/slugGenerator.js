import slugify from 'slugify';

export const generateSlug = (text, existingSlugs = []) => {
    // Convert to lowercase and remove special characters
    let baseSlug = slugify(text, {
        lower: true,
        strict: true,
        locale: 'fa', // Support for Persian characters
        remove: /[*+~.()'"!:@]/g
    });

    // If the slug already exists, append a number
    let finalSlug = baseSlug;
    let counter = 1;

    while (existingSlugs.includes(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
    }

    return finalSlug;
};

export const generateCategorySlug = async (name, parentSlug = null, Category) => {
    // Get all existing slugs
    const existingCategories = await Category.findAll({
        attributes: ['slug'],
        where: {
            deleted_at: null
        }
    });
    const existingSlugs = existingCategories.map(cat => cat.slug);

    // Generate base slug
    let baseSlug = generateSlug(name, existingSlugs);

    // If there's a parent, prepend its slug
    if (parentSlug) {
        baseSlug = `${parentSlug}/${baseSlug}`;
    }

    return baseSlug;
}; 