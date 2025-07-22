import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { SliderService } from '../services/slider.service.js';
import { Product } from '../../products/models/product.model.js';
import { Category } from '../../categories/models/category.model.js';

export class SliderController {
  // افزودن محصول به slider
  static async addProductToSlider(req: Request, res: Response) {
    try {
      const { refId, order } = req.body;
      const item = await SliderService.addItem('Product', new Types.ObjectId(refId), order);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // افزودن دسته‌بندی به slider
  static async addCategoryToSlider(req: Request, res: Response) {
    try {
      const { refId, order } = req.body;
      const item = await SliderService.addItem('Category', new Types.ObjectId(refId), order);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // حذف آیتم از slider
  static async removeSliderItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await SliderService.removeItem(new Types.ObjectId(id));
      res.status(204).send();
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // لیست محصولات slider
  static async listSliderProducts(_req: Request, res: Response) {
    try {
      const items = await SliderService.list('Product');
      res.json(items);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // لیست دسته‌بندی‌های slider
  static async listSliderCategories(_req: Request, res: Response) {
    try {
      const items = await SliderService.list('Category');
      res.json(items);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // لیست جدیدترین محصولات با sort و paging
  static async newProducts(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, sort = 'created_at', order = -1 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const sortObj: any = {};
      sortObj[String(sort)] = Number(order);
      // فرض بر این است که فیلد created_at در مدل Product وجود دارد
      const products = await Product.find({})
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit));
      res.json(products);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // لیست جدیدترین دسته‌بندی‌ها با sort و paging
  static async newCategories(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, sort = 'createdAt', order = -1 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const sortObj: any = {};
      sortObj[String(sort)] = Number(order);
      // فرض بر این است که فیلد createdAt در مدل Category وجود دارد
      const categories = await Category.find({})
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit));
      res.json(categories);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // اسکلت best (فعلاً خالی)
  static async best(_req: Request, res: Response) {
    // بعداً پیاده‌سازی می‌شود
    res.json({ best: [] });
  }

  // دریافت همه داده‌های slider، new و best به صورت آبجکت تو در تو
  static async getAll(_req: Request, res: Response) {
    try {
      // slider
      const sliderProducts = await SliderService.list('Product');
      const sliderCategories = await SliderService.list('Category');
      // new
      const newProducts = await Product.find({}).sort({ created_at: -1 }).limit(20);
      const newCategories = await Category.find({}).sort({ createdAt: -1 }).limit(20);
      // best (فعلاً خالی)
      const best: any[] = [];
      res.json({
        slider: {
          products: sliderProducts,
          categories: sliderCategories,
        },
        new: {
          products: newProducts,
          categories: newCategories,
        },
        best,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
