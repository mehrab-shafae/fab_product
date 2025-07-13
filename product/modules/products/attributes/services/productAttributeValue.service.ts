import { ProductAttributeValue, IProductAttributeValue } from '../models/productAttributeValue.model.js';
// import { ICategoryAttribute } from '../../../categories/models/categoryAttribute.model.js';

export const addProductAttributeValue = async (data: Partial<IProductAttributeValue>) => {
      const value = new ProductAttributeValue(data);
      return await value.save();
};

export const getProductAttributeValues = async (product_id: string) => {
      const values = await ProductAttributeValue.find({ product_id, deleted_at: null })
            .populate('attribute_id')
            .lean();
      
      // Filter out values where attribute_id is null or the attribute is deleted
      const validValues = values.filter(value => {
            if (!value.attribute_id || typeof value.attribute_id === 'string') {
                  return false;
            }
            // const attribute = value.attribute_id as unknown as ICategoryAttribute;
            return true; // CategoryAttribute doesn't have deleted_at field
      });
      
      return validValues;
};

// Alternative function that returns all values with attribute info (including null ones)
export const getAllProductAttributeValues = async (product_id: string) => {
      const values = await ProductAttributeValue.find({ product_id, deleted_at: null })
            .populate('attribute_id')
            .lean();
      
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
                  has_valid_attribute: hasValidAttribute
            };
      });
};
