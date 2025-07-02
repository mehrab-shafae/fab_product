import { ProductRelationship, IProductRelationship } from '../models/productRelationship.model';

export const addProductRelationship = async (data: Partial<IProductRelationship>) => {
      const relationship = new ProductRelationship(data);
      return await relationship.save();
};

export const getProductRelationships = async (product_id: string, relationship_type?: string) => {
      const query: any = { product_id, deleted_at: null };
      if (relationship_type) query.relationship_type = relationship_type;
      return await ProductRelationship.find(query).populate('related_product_id');
};

export const deleteProductRelationship = async (id: string) => {
      return await ProductRelationship.findByIdAndUpdate(id, { deleted_at: new Date() }, { new: true });
};
