import { ProductVariant, IProductVariant } from '../models/productVariant.model.js';
import { ProductAttribute } from '../../attributes/models/productAttribute.model.js';

export const createProductVariant = async (data: Partial<IProductVariant>) => {
      // اعتبارسنجی attributes
      if (!Array.isArray(data.attributes) || data.attributes.length === 0) {
            throw new Error('attributes must be a non-empty array');
      }
      for (const attr of data.attributes) {
            if (!attr.attribute_id) {
                  throw new Error('Each attribute must have attribute_id');
            }
            const attribute = await ProductAttribute.findById(attr.attribute_id);
            if (!attribute || attribute.deleted_at) {
                  throw new Error(`Invalid attribute_id: ${attr.attribute_id}`);
            }
            // اعتبارسنجی مقدار بر اساس data_type (مثال ساده)
            if (attribute.data_type === 'number' && typeof attr.value !== 'number') {
                  throw new Error(`Value for attribute ${attribute.name} must be a number`);
            }
            if (attribute.data_type === 'string' && typeof attr.value !== 'string') {
                  throw new Error(`Value for attribute ${attribute.name} must be a string`);
            }
            if (attribute.data_type === 'select' && attribute.options && !attribute.options.includes(attr.value)) {
                  throw new Error(`Value for attribute ${attribute.name} must be one of: ${attribute.options.join(', ')}`);
            }
      }
      const variant = new ProductVariant(data);
      return await variant.save();
};

export const getProductVariants = async (product_id: string) => {
      return await ProductVariant.find({ product_id, deleted_at: null })
            .sort({ created_at: -1 })
            .populate('attributes.attribute_id');
};

export const deleteProductVariant = async (id: string) => {
      return await ProductVariant.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
