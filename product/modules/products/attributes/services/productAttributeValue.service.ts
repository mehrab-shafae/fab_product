import { ProductAttributeValue, IProductAttributeValue } from '../models/productAttributeValue.model.js';
import { CategoryAttribute } from '../../../categories/models/categoryAttribute.model.js';
// import { ICategoryAttribute } from '../../../categories/models/categoryAttribute.model.js';
import { Product } from '../../models/product.model.js';
import { ProductAttribute } from '../models/productAttribute.model.js';

export const addProductAttributeValue = async (data: Partial<IProductAttributeValue>) => {
      // اعتبارسنجی attribute_id
      if (!data.attribute_id) {
            throw new Error('attribute_id is required');
      }
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

export const searchProductsByAttributes = async (
    filters: Array<{ attribute: string, values: string[] }>,
    slugs?: string[],
    page: number = 1,
    limit: number = 20
) => {
    // 1. پیدا کردن attribute_id ها بر اساس نام attribute (case-insensitive)
    const attributeDocs = await ProductAttribute.find({
        $or: filters.map(f => ({ name: { $regex: `^${f.attribute}$`, $options: 'i' } })),
        deleted_at: null
    });
    const attributeMap = Object.fromEntries(attributeDocs.map(attr => [attr.name.toLowerCase(), attr._id]));

    // 2. ساخت query برای ProductAttributeValue (هر attribute با OR روی valueها)
    const attrQueries = filters.map(f => ({
        attribute_id: attributeMap[f.attribute.toLowerCase()],
        value: { $in: f.values },
        deleted_at: null
    }));

    // 3. پیدا کردن product_id هایی که برای هر attribute حداقل یکی از valueها را دارند (AND بین attributeها)
    // یعنی هر محصول باید به تعداد attributeهای فیلتر شده، رکورد attributeValue داشته باشد
    const pipeline = [
        { $match: { $or: attrQueries } },
        { $group: { _id: "$product_id", attrs: { $addToSet: "$attribute_id" } } },
        { $match: { "attrs.0": { $exists: true } } }, // حداقل یک attribute داشته باشد
        { $match: { $expr: { $eq: [ { $size: "$attrs" }, filters.length ] } } } // دقیقا به تعداد attributeهای فیلتر شده
    ];
    const matched = await ProductAttributeValue.aggregate(pipeline);
    const productIds = matched.map(m => m._id);

    // 4. گرفتن اطلاعات کامل محصولات با صفحه‌بندی
    const productQuery: any = { _id: { $in: productIds }, deleted_at: null };
    if (Array.isArray(slugs) && slugs.length > 0) {
        productQuery.slug = { $in: slugs };
    }
    const total = await Product.countDocuments(productQuery);
    const products = await Product.find(productQuery)
        .skip((page - 1) * limit)
        .limit(limit);

    // 5. گرفتن attribute/value های هر محصول
    const attrValues = await ProductAttributeValue.find({ product_id: { $in: productIds }, deleted_at: null }).populate('attribute_id');
    const attrByProduct: Record<string, Array<{ attribute: string, value: string }>> = {};
    for (const av of attrValues) {
        const pid = String(av.product_id);
        if (!attrByProduct[pid]) attrByProduct[pid] = [];
        let attrName: string = (typeof av.attribute_id === 'object' && av.attribute_id !== null && 'name' in av.attribute_id)
            ? String((av.attribute_id as any).name)
            : String(av.attribute_id);
        attrByProduct[pid].push({
            attribute: attrName,
            value: av.value
        });
    }

    // 6. ساخت خروجی نهایی
    const data = products.map(p => {
        const prod: any = p;
        return {
            product: prod,
            attributes: attrByProduct[String(prod._id)] || []
        };
    });
    return {
        data,
        count: data.length,
        page,
        limit,
        total
    };
};

export const searchProductsByAttributesOnly = async (
    filters: Array<{ attribute: string, values: string[] }>,
    slugs?: string[],
    page: number = 1,
    limit: number = 20
) => {
    // 1. پیدا کردن attribute_id ها بر اساس نام attribute (case-insensitive)
    const attributeDocs = await ProductAttribute.find({
        $or: filters.map(f => ({ name: { $regex: `^${f.attribute}$`, $options: 'i' } })),
        deleted_at: null
    });
    const attributeMap = Object.fromEntries(attributeDocs.map(attr => [attr.name.toLowerCase(), attr._id]));

    // 2. ساخت query برای ProductAttributeValue (هر attribute با OR روی valueها)
    const attrQueries = filters.map(f => ({
        attribute_id: attributeMap[f.attribute.toLowerCase()],
        value: f.values && f.values.length > 0 ? { $in: f.values } : undefined,
        deleted_at: null
    }));

    // 3. پیدا کردن product_id هایی که برای هر attribute حداقل یکی از valueها را دارند (AND بین attributeها)
    const pipeline = [
        { $match: { $or: attrQueries } },
        { $group: { _id: "$product_id", attrs: { $addToSet: "$attribute_id" } } },
        { $match: { $expr: { $eq: [ { $size: "$attrs" }, filters.length ] } } }
    ];
    const matched = await ProductAttributeValue.aggregate(pipeline);
    const productIds = matched.map(m => m._id);

    // 4. گرفتن اطلاعات کامل محصولات با صفحه‌بندی
    const productQuery: any = { _id: { $in: productIds }, deleted_at: null };
    if (Array.isArray(slugs) && slugs.length > 0) {
        productQuery.slug = { $in: slugs };
    }
    const total = await Product.countDocuments(productQuery);
    const products = await Product.find(productQuery)
        .skip((page - 1) * limit)
        .limit(limit);

    // 5. گرفتن attribute/value های هر محصول
    const attrValues = await ProductAttributeValue.find({ product_id: { $in: productIds }, deleted_at: null }).populate('attribute_id');
    const attrByProduct: Record<string, Array<{ attribute: string, value: string }>> = {};
    for (const av of attrValues) {
        const pid = String(av.product_id);
        if (!attrByProduct[pid]) attrByProduct[pid] = [];
        let attrName: string = (typeof av.attribute_id === 'object' && av.attribute_id !== null && 'name' in av.attribute_id)
            ? String((av.attribute_id as any).name)
            : String(av.attribute_id);
        attrByProduct[pid].push({
            attribute: attrName,
            value: av.value
        });
    }

    // 6. ساخت خروجی نهایی
    const data = products.map(p => {
        const prod: any = p;
        return {
            product: prod,
            attributes: attrByProduct[String(prod._id)] || []
        };
    });
    return {
        data,
        count: data.length,
        page,
        limit,
        total
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
