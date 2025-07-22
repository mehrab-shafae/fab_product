import { Types } from 'mongoose';
import { Slider, ISlider } from '../models/slider.model.js';
import { Product, IProduct } from '../../products/models/product.model.js';
import { Category, ICategory } from '../../categories/models/category.model.js';

export type SliderPopulated = {
  type: 'Product' | 'Category';
  refId: IProduct | ICategory;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;
};

export class SliderService {
  // افزودن آیتم جدید به slider
  static async addItem(type: 'Product' | 'Category', refId: Types.ObjectId, order = 0): Promise<ISlider> {
    // تبدیل به حرف بزرگ برای سازگاری با مدل mongoose
    if (type !== 'Product' && type !== 'Category') {
      throw new Error('Invalid type');
    }
    if (type === 'Product') {
      const exists = await Product.exists({ _id: refId });
      if (!exists) throw new Error('Product not found');
    } else if (type === 'Category') {
      const exists = await Category.exists({ _id: refId });
      if (!exists) throw new Error('Category not found');
    }
    const slider = new Slider({ type, refId, order });
    return slider.save();
  }

  // حذف آیتم از slider
  static async removeItem(id: Types.ObjectId): Promise<void> {
    await Slider.findByIdAndDelete(id);
  }

  // لیست آیتم‌های slider بر اساس نوع
  static async list(type?: 'Product' | 'Category'): Promise<SliderPopulated[]> {
    const filter = type ? { type } : {};
    const docs = await Slider.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .populate({ path: 'refId' })
      .exec();
    // تبدیل امن به SliderPopulated[]
    return docs.map(doc => {
      const obj = doc.toObject() as unknown as SliderPopulated;
      return obj;
    });
  }
}
