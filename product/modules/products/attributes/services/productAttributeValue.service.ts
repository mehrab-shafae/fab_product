import { ProductAttributeValue, IProductAttributeValue } from '../models/productAttributeValue.model.js';
import { CategoryAttribute } from '../../../categories/models/categoryAttribute.model.js';
// import { ICategoryAttribute } from '../../../categories/models/categoryAttribute.model.js';
import { Product } from '../../models/product.model.js';
import { Category } from '../../../categories/models/category.model.js';

export const addProductAttributeValue = async (data: Partial<IProductAttributeValue>) => {
      // اعتبارسنجی attribute_id
      if (!data.attribute_id) {
            throw new Error('attribute_id is required');
      }
      // attribute_id باید شناسه CategoryAttribute باشد
      const categoryAttribute = await CategoryAttribute.findById(data.attribute_id);
      if (!categoryAttribute) {
            throw new Error('Invalid attribute_id: No such CategoryAttribute');
      }
      const value = new ProductAttributeValue(data);
      return await value.save();
};

export const getProductAttributeValues = async (product_id: string) => {
      const values = await ProductAttributeValue.find({ product_id, deleted_at: null }).populate('attribute_id');

      // Filter out values where attribute_id is null or the attribute is deleted
      const validValues = values.filter(value => {
            if (!value.attribute_id || typeof value.attribute_id === 'string') {
                  return false;
            }
            return true; // CategoryAttribute doesn't have deleted_at field
      });
      return validValues;
};

// Alternative function that returns all values with attribute info (including null ones)
export const getAllProductAttributeValues = async (product_id: string) => {
      const values = await ProductAttributeValue.find({ product_id, deleted_at: null }).populate('attribute_id');

      return values.map(value => {
            let hasValidAttribute = false;
            if (value.attribute_id && typeof value.attribute_id !== 'string') {
                  hasValidAttribute = true; // CategoryAttribute doesn't have deleted_at field
            }
            return {
                  _id: value._id,
                  product_id: value.product_id,
                  attribute_id: value.attribute_id,
                  value: value.value,
                  created_at: value.created_at,
                  updated_at: value.updated_at,
                  has_valid_attribute: hasValidAttribute,
            };
      });
};

export const searchProductsByAttributes = async (filters?: Array<{ attribute: string; values: string[] }>, slugs?: string[], page: number = 1, limit: number = 20) => {
      let productIds: string[] = [];

      // If filters are provided, search by attributes
      if (filters && Array.isArray(filters) && filters.length > 0) {
            // 1. پیدا کردن attribute_id ها بر اساس نام attribute (case-insensitive)
            const attributeDocs = await CategoryAttribute.find({
                  $or: (filters as Array<{ attribute: string; values: string[] }>).map(f => ({ name: { $regex: `^${f.attribute}$`, $options: 'i' } })),
            });
            const attributeMap = Object.fromEntries(attributeDocs.map((attr: any) => [String(attr.name).toLowerCase(), attr._id]));

            // 2. ساخت query برای ProductAttributeValue (هر attribute با OR روی valueها)
            const attrQueries = (filters as Array<{ attribute: string; values: string[] }>).map(f => ({
                  attribute_id: attributeMap[f.attribute.toLowerCase()],
                  value: { $in: f.values },
                  deleted_at: null,
            }));

            // 3. پیدا کردن product_id هایی که برای هر attribute حداقل یکی از valueها را دارند (AND بین attributeها)
            const pipeline = [
                  { $match: { $or: attrQueries } },
                  { $group: { _id: '$product_id', attrs: { $addToSet: '$attribute_id' } } },
                  { $match: { 'attrs.0': { $exists: true } } }, // حداقل یک attribute داشته باشد
                  { $match: { $expr: { $eq: [{ $size: '$attrs' }, filters.length] } } }, // دقیقا به تعداد attributeهای فیلتر شده
            ];
            const matched = await ProductAttributeValue.aggregate(pipeline);
            productIds = matched.map(m => m._id);

            // اگر هیچ محصولی با فیلترهای attribute پیدا نشد، نتیجه خالی برگردان
            if (productIds.length === 0) {
                  return {
                        data: [],
                        count: 0,
                        page,
                        limit,
                        total: 0,
                  };
            }
      }

      // 4. گرفتن اطلاعات کامل محصولات با صفحه‌بندی
      const productQuery: any = { deleted_at: null };

      // If we have product IDs from filters, use them
      if (productIds.length > 0) {
            productQuery._id = { $in: productIds };
      }

      // If slugs are provided, filter by them
      if (slugs && Array.isArray(slugs) && slugs.length > 0) {
            if (productIds.length > 0) {
                  // If we already have product IDs from filters, intersect with slugs
                  const slugProducts = await Product.find({ slug: { $in: slugs }, deleted_at: null }).select('_id');
                  const slugProductIds = slugProducts.map(p => p._id);
                  productQuery._id = { $in: productIds.filter(id => slugProductIds.includes(id)) };
            } else {
                  // If no filters, just search by slugs
                  productQuery.slug = { $in: slugs };
            }
      }

      // If neither filters nor slugs are provided, return empty result
      if (productIds.length === 0 && (!slugs || !Array.isArray(slugs) || slugs.length === 0)) {
            return {
                  data: [],
                  count: 0,
                  page,
                  limit,
                  total: 0,
            };
      }

      const total = await Product.countDocuments(productQuery);
      const products = await Product.find(productQuery)
            .skip((page - 1) * limit)
            .limit(limit);

      // 5. گرفتن attribute/value های هر محصول
      const productIdsForAttrs = products.map(p => p._id);
      const attrValues = await ProductAttributeValue.find({
            product_id: { $in: productIdsForAttrs },
            deleted_at: null,
      }).populate('attribute_id');

      const attrByProduct: Record<string, Array<{ attribute: string; value: string }>> = {};
      for (const av of attrValues) {
            const pid = String(av.product_id);
            if (!attrByProduct[pid]) attrByProduct[pid] = [];
            let attrName: string = typeof av.attribute_id === 'object' && av.attribute_id !== null && 'name' in av.attribute_id ? String((av.attribute_id as any).name) : String(av.attribute_id);
            attrByProduct[pid].push({
                  attribute: attrName,
                  value: av.value,
            });
      }

      // 6. ساخت خروجی نهایی
      const data = products.map(p => {
            const prod: any = p;
            return {
                  product: prod,
                  attributes: attrByProduct[String(prod._id)] || [],
            };
      });
      return {
            data,
            count: data.length,
            page,
            limit,
            total,
      };
};

export const searchProductsByAttributesOnly = async (filters?: Array<{ attribute: string; values: string[] }>, slugs?: string[], page: number = 1, limit: number = 20) => {
      let productIds: string[] = [];

      // If filters are provided, search by attributes
      if (filters && Array.isArray(filters) && filters.length > 0) {
            // 1. پیدا کردن attribute_id ها بر اساس نام attribute (case-insensitive)
            const attributeDocs = await CategoryAttribute.find({
                  $or: (filters as Array<{ attribute: string; values: string[] }>).map(f => ({ name: { $regex: `^${f.attribute}$`, $options: 'i' } })),
            });
            const attributeMap = Object.fromEntries(attributeDocs.map((attr: any) => [String(attr.name).toLowerCase(), attr._id]));

            // 2. ساخت query برای ProductAttributeValue (هر attribute با OR روی valueها)
            const attrQueries = (filters as Array<{ attribute: string; values: string[] }>).map(f => ({
                  attribute_id: attributeMap[f.attribute.toLowerCase()],
                  value: f.values && f.values.length > 0 ? { $in: f.values } : undefined,
                  deleted_at: null,
            }));

            // 3. پیدا کردن product_id هایی که برای هر attribute حداقل یکی از valueها را دارند (AND بین attributeها)
            const pipeline = [{ $match: { $or: attrQueries } }, { $group: { _id: '$product_id', attrs: { $addToSet: '$attribute_id' } } }, { $match: { $expr: { $eq: [{ $size: '$attrs' }, filters.length] } } }];
            const matched = await ProductAttributeValue.aggregate(pipeline);
            productIds = matched.map(m => m._id);

            // اگر هیچ محصولی با فیلترهای attribute پیدا نشد، نتیجه خالی برگردان
            if (productIds.length === 0) {
                  return {
                        data: [],
                        count: 0,
                        page,
                        limit,
                        total: 0,
                  };
            }
      }

      // 4. گرفتن اطلاعات کامل محصولات با صفحه‌بندی
      const productQuery: any = { deleted_at: null };

      // If we have product IDs from filters, use them
      if (productIds.length > 0) {
            productQuery._id = { $in: productIds };
      }

      // If slugs are provided, filter by them
      if (slugs && Array.isArray(slugs) && slugs.length > 0) {
            if (productIds.length > 0) {
                  // If we already have product IDs from filters, intersect with slugs
                  const slugProducts = await Product.find({ slug: { $in: slugs }, deleted_at: null }).select('_id');
                  const slugProductIds = slugProducts.map(p => p._id);
                  productQuery._id = { $in: productIds.filter(id => slugProductIds.includes(id)) };
            } else {
                  // If no filters, just search by slugs
                  productQuery.slug = { $in: slugs };
            }
      }

      // If neither filters nor slugs are provided, return empty result
      if (productIds.length === 0 && (!slugs || !Array.isArray(slugs) || slugs.length === 0)) {
            return {
                  data: [],
                  count: 0,
                  page,
                  limit,
                  total: 0,
            };
      }

      const total = await Product.countDocuments(productQuery);
      const products = await Product.find(productQuery)
            .skip((page - 1) * limit)
            .limit(limit);

      // 5. گرفتن attribute/value های هر محصول
      const productIdsForAttrs = products.map(p => p._id);
      const attrValues = await ProductAttributeValue.find({
            product_id: { $in: productIdsForAttrs },
            deleted_at: null,
      }).populate('attribute_id');

      const attrByProduct: Record<string, Array<{ attribute: string; value: string }>> = {};
      for (const av of attrValues) {
            const pid = String(av.product_id);
            if (!attrByProduct[pid]) attrByProduct[pid] = [];
            let attrName: string = typeof av.attribute_id === 'object' && av.attribute_id !== null && 'name' in av.attribute_id ? String((av.attribute_id as any).name) : String(av.attribute_id);
            attrByProduct[pid].push({
                  attribute: attrName,
                  value: av.value,
            });
      }

      // 6. ساخت خروجی نهایی
      const data = products.map(p => {
            const prod: any = p;
            return {
                  product: prod,
                  attributes: attrByProduct[String(prod._id)] || [],
            };
      });
      return {
            data,
            count: data.length,
            page,
            limit,
            total,
      };
};

export const searchProductsByCategorySlugsAndAttributes = async (categorySlugs?: string[], filters?: Array<{ attribute: string; values: string[] }>, page: number = 1, limit: number = 20, minPrice?: number, maxPrice?: number, sortBy?: 'minPrice' | 'maxPrice', sortOrder?: 'asc' | 'desc') => {
      // 1) Build category filter (optional)
      let allCategoryIds: Set<string> | undefined = undefined;
      let categories: any[] = [];
      if (categorySlugs && Array.isArray(categorySlugs) && categorySlugs.length > 0) {
            categories = await Category.find({ slug: { $in: categorySlugs }, deleted_at: null });
            if (categories.length === 0) {
                  return {
                        data: [],
                        count: 0,
                        page,
                        limit,
                        total: 0,
                        categories: [],
                        totalCategories: 0,
                        message: 'No categories found with the provided slugs',
                  };
            }
            const categoryIds = categories.map(c => c._id);
            allCategoryIds = new Set<string>(categoryIds.map(id => id?.toString?.() ?? String(id)));
            const getAllDescendants = async (parentIds: string[]) => {
                  const children = await Category.find({ parent_id: { $in: parentIds }, deleted_at: null });
                  if (!children || children.length === 0) return;
                  const childIds = children.map((c: any) => (typeof c._id === 'object' && typeof c._id.toString === 'function' ? c._id.toString() : String(c._id))).filter(Boolean);
                  childIds.forEach(id => allCategoryIds!.add(id));
                  await getAllDescendants(childIds);
            };
            const categoryIdsAsStrings = categoryIds.map(id => (typeof id === 'object' && id !== null && typeof (id as any).toString === 'function' ? (id as any).toString() : String(id)));
            await getAllDescendants(categoryIdsAsStrings);
      }

      // 2) Prepare attribute ID mapping (if attribute filters exist)
      const hasAttributeFilters = !!(filters && Array.isArray(filters) && filters.length > 0);
      const hasPriceFilter = typeof minPrice === 'number' || typeof maxPrice === 'number';

      let normalizedFilters: Array<{ attrId: string; valuesLower: string[] }> = [];
      if (hasAttributeFilters) {
            const attributeDocs = await CategoryAttribute.find({
                  $or: filters!.map(f => ({ name: { $regex: `^${f.attribute}$`, $options: 'i' } })),
            });
            const nameToId: Record<string, string> = Object.fromEntries(attributeDocs.map((a: any) => [String(a.name).toLowerCase(), a._id.toString()]));
            normalizedFilters = filters!.map(f => {
                  const attrId = nameToId[f.attribute.toLowerCase()] || f.attribute; // support direct id
                  const valuesLower = (f.values || []).map(v => String(v).toLowerCase());
                  return { attrId, valuesLower };
            });
      }

      // 3) Build aggregation pipeline
      const pipeline: any[] = [];

      // base match
      const baseMatch: any = { deleted_at: null };
      if (allCategoryIds) {
            baseMatch.category_id = { $in: Array.from(allCategoryIds) };
      }
      pipeline.push({ $match: baseMatch });

      // helper to build matchingVariants filter when filters/price present
      const needsMatching = hasAttributeFilters || hasPriceFilter;
      if (needsMatching) {
            const condAnd: any[] = [];
            // price conditions on variant
            if (typeof minPrice === 'number') {
                  condAnd.push({ $gte: ['$$v.inventory.price', minPrice] });
            }
            if (typeof maxPrice === 'number') {
                  condAnd.push({ $lte: ['$$v.inventory.price', maxPrice] });
            }
            // attribute conditions (AND across filters; for each filter, at least one attribute in variant must match)
            for (const nf of normalizedFilters) {
                  condAnd.push({
                        $anyElementTrue: {
                              $map: {
                                    input: { $ifNull: ['$$v.attributes', []] },
                                    as: 'a',
                                    in: {
                                          $and: [{ $eq: [{ $toString: '$$a.attribute_id' }, nf.attrId] }, { $in: [{ $toLower: { $ifNull: ['$$a.value', ''] } }, nf.valuesLower] }],
                                    },
                              },
                        },
                  });
            }
            const variantsFilterCond = condAnd.length > 0 ? { $and: condAnd } : true;
            pipeline.push({
                  $addFields: {
                        matchingVariants: {
                              $filter: {
                                    input: { $ifNull: ['$variants', []] },
                                    as: 'v',
                                    cond: variantsFilterCond,
                              },
                        },
                  },
            });
            // keep only products having at least one matching variant
            pipeline.push({ $match: { $expr: { $gt: [{ $size: { $ifNull: ['$matchingVariants', []] } }, 0] } } });
            // compute min/max price over matching variants for sorting
            pipeline.push({
                  $addFields: {
                        minMatchingVariantPrice: {
                              $min: {
                                    $map: { input: { $ifNull: ['$matchingVariants', []] }, as: 'mv', in: '$$mv.inventory.price' },
                              },
                        },
                        maxMatchingVariantPrice: {
                              $max: {
                                    $map: { input: { $ifNull: ['$matchingVariants', []] }, as: 'mv', in: '$$mv.inventory.price' },
                              },
                        },
                  },
            });
      } else {
            // no filters; still allow sort by overall variant prices
            pipeline.push({
                  $addFields: {
                        minMatchingVariantPrice: {
                              $min: { $map: { input: { $ifNull: ['$variants', []] }, as: 'mv', in: '$$mv.inventory.price' } },
                        },
                        maxMatchingVariantPrice: {
                              $max: { $map: { input: { $ifNull: ['$variants', []] }, as: 'mv', in: '$$mv.inventory.price' } },
                        },
                  },
            });
      }

      // sorting
      const sortStage: any = {};
      if (sortBy === 'minPrice') {
            sortStage.minMatchingVariantPrice = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'maxPrice') {
            sortStage.maxMatchingVariantPrice = sortOrder === 'desc' ? -1 : 1;
      }

      // facet for pagination and total
      const dataPipeline: any[] = [];
      if (Object.keys(sortStage).length > 0) {
            dataPipeline.push({ $sort: sortStage });
      }
      dataPipeline.push({ $skip: (page - 1) * limit });
      dataPipeline.push({ $limit: limit });
      dataPipeline.push({ $project: { matchingVariants: 0, minMatchingVariantPrice: 0, maxMatchingVariantPrice: 0 } });

      pipeline.push({
            $facet: {
                  data: dataPipeline,
                  count: [{ $count: 'total' }],
            },
      });

      // execute aggregation
      const aggResult = await Product.aggregate(pipeline);
      const first = aggResult[0] || { data: [], count: [] };
      const data = first.data || [];
      const total = first.count && first.count[0] && first.count[0].total ? first.count[0].total : 0;

      return {
            data,
            count: data.length,
            page,
            limit,
            total,
            categories: categories.map(c => ({ _id: c._id, name: c.name, slug: c.slug })),
            totalCategories: allCategoryIds ? allCategoryIds.size : 0,
      };
};

// export const searchAttrValue = async (value: string, param: string) => {
//       const docs = await ProductAttributeValue.find({
//       deleted_at: null,
//       attribute_id: attributeId,
//       value: { $regex: valueToSearch, $options: 'i' }
//       }).populate({
//       path: 'attribute_id',
//       match: { deleted_at: null },
//       select: 'name options data_type'
//       });

// };
