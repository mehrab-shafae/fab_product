import { Product, IProduct } from '../models/product.model.js';

export const createProduct = async (data: Partial<IProduct>) => {
      const product = new Product(data);
      return await product.save();
};

export const getProductById = async (id: string) => {
      return await Product.findById(id);
};

export const updateProduct = async (id: string, data: Partial<IProduct>) => {
      return await Product.findByIdAndUpdate(id, data, { new: true });
};

export const deleteProduct = async (id: string) => {
      return await Product.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};

export const searchProducts = async (params: any) => {
      const { page = 1, limit = 10, name, category_id, min_price, max_price, tags, attributes, sortField = 'created_at', sortOrder = 'desc' } = params;

      const query: any = { deleted_at: null };
      if (name) query.name = { $regex: name, $options: 'i' };
      if (category_id) query.category_id = category_id;
      if (min_price !== undefined) query.price = { ...query.price, $gte: Number(min_price) };
      if (max_price !== undefined) query.price = { ...query.price, $lte: Number(max_price) };

      // فیلتر بر اساس تگ‌ها
      let productIdsByTags: string[] | undefined = undefined;
      if (tags && Array.isArray(tags) && tags.length > 0) {
            const tagDocs = await (await import('../tags/models/productTag.model.js')).ProductTag.find({ tag_name: { $in: tags }, deleted_at: null }).select('product_id');
            productIdsByTags = tagDocs.map((t: any) => t.product_id.toString());
            query._id = { $in: productIdsByTags };
      }

      // فیلتر بر اساس ویژگی‌ها (attributes)
      if (attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
            for (const [key, value] of Object.entries(attributes)) {
                  query[`metadata.${key}`] = value;
            }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const sort: any = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

      const [items, total] = await Promise.all([Product.find(query).sort(sort).skip(skip).limit(Number(limit)), Product.countDocuments(query)]);

      return {
            items,
            pagination: {
                  total,
                  page: Number(page),
                  limit: Number(limit),
                  pages: Math.ceil(total / Number(limit)),
            },
      };
};
