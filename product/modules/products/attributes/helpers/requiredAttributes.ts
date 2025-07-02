import { Types } from 'mongoose';
import { Category } from '../../../../categories/models/category.model';
import { CategoryAttribute } from '../../../../categories/models/categoryAttribute.model';

/**
 * دریافت لیست attributeهای اجباری یک دسته و والدهایش (به ترتیب والد تا فرزند)
 * @param categoryId
 * @returns Promise<Array<{_id, name, type, required, categoryId}>>
 */
export async function getRequiredAttributesRecursive(categoryId: Types.ObjectId | string) {
  let attributes: any[] = [];
  let currentCategoryId: Types.ObjectId | string | null = categoryId;
  const visited = new Set<string>();
  while (currentCategoryId) {
    if (visited.has(currentCategoryId.toString())) break; // جلوگیری از حلقه بی‌نهایت
    visited.add(currentCategoryId.toString());
    // دریافت attributeهای اجباری این دسته
    const attrs = await CategoryAttribute.find({ categoryId: currentCategoryId, required: true }).lean();
    attributes = [...attrs, ...attributes];
    // دریافت والد
    const cat = await Category.findById(currentCategoryId).lean();
    currentCategoryId = cat && cat.parentId ? cat.parentId : null;
  }
  return attributes;
} 