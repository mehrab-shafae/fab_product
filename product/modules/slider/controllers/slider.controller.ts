import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { SliderService } from '../services/slider.service.js';
import { SimpleSliderInfoService } from '../services/slider.service.js';
import { Product } from '../../products/models/product.model.js';
import { Category } from '../../categories/models/category.model.js';

export class SliderController {
      // افزودن محصول به slider
      static async addProductToSlider(req: Request, res: Response) {
            try {
                  const { refId, order } = req.body;
                  const item = await SliderService.addItem('Product', new Types.ObjectId(refId), order);
                  // Populate refId
                  await item.populate('refId');
                  res.status(201).json({
                        status: 'success',
                        message: 'محصول با موفقیت به اسلایدر اضافه شد',
                        data: item,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // افزودن دسته‌بندی به slider
      static async addCategoryToSlider(req: Request, res: Response) {
            try {
                  const { refId, order } = req.body;
                  const item = await SliderService.addItem('Category', new Types.ObjectId(refId), order);
                  // Populate refId
                  await item.populate('refId');
                  res.status(201).json({
                        status: 'success',
                        message: 'دسته‌بندی با موفقیت به اسلایدر اضافه شد',
                        data: item,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // حذف آیتم از slider
      static async removeSliderItem(req: Request, res: Response) {
            try {
                  const { id } = req.params;
                  await SliderService.removeItem(new Types.ObjectId(id));
                  res.status(200).json({
                        status: 'success',
                        message: 'آیتم با موفقیت از اسلایدر حذف شد',
                        data: null,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // لیست محصولات slider
      static async listSliderProducts(_req: Request, res: Response) {
            try {
                  const items = await SliderService.list('Product');
                  res.json({
                        status: 'success',
                        message: 'لیست محصولات اسلایدر',
                        data: items,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // لیست دسته‌بندی‌های slider
      static async listSliderCategories(_req: Request, res: Response) {
            try {
                  const items = await SliderService.list('Category');
                  res.json({
                        status: 'success',
                        message: 'لیست دسته‌بندی‌های اسلایدر',
                        data: items,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // لیست جدیدترین محصولات با sort و paging
      static async newProducts(req: Request, res: Response) {
            try {
                  const { page = 1, limit = 10, sort = 'created_at', order = -1 } = req.query;
                  const skip = (Number(page) - 1) * Number(limit);
                  const sortObj: any = {};
                  sortObj[String(sort)] = Number(order);
                  // فقط محصولات فعال و حذف‌نشده
                  const products = await Product.find({ deleted_at: null, status: 'active' }).sort(sortObj).skip(skip).limit(Number(limit));
                  res.json({
                        status: 'success',
                        message: 'جدیدترین محصولات',
                        data: products,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // لیست جدیدترین دسته‌بندی‌ها با sort و paging
      static async newCategories(req: Request, res: Response) {
            try {
                  const { page = 1, limit = 10, sort = 'createdAt', order = -1 } = req.query;
                  const skip = (Number(page) - 1) * Number(limit);
                  const sortObj: any = {};
                  sortObj[String(sort)] = Number(order);
                  // فقط دسته‌بندی‌های فعال
                  const categories = await Category.find({ status: 'active' }).sort(sortObj).skip(skip).limit(Number(limit));
                  res.json({
                        status: 'success',
                        message: 'جدیدترین دسته‌بندی‌ها',
                        data: categories,
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // اسکلت best (فعلاً خالی)
      static async best(_req: Request, res: Response) {
            res.json({
                  status: 'success',
                  message: 'بهترین‌ها',
                  data: { best: [] },
            });
      }

      // دریافت همه داده‌های slider، new و best به صورت آبجکت تو در تو
      static async getAll(_req: Request, res: Response) {
            try {
                  const sliderProducts = await SliderService.list('Product');
                  const sliderCategories = await SliderService.list('Category');
                  const newProducts = await Product.find({}).sort({ created_at: -1 }).limit(20);
                  const newCategories = await Category.find({}).sort({ createdAt: -1 }).limit(20);
                  const best: any[] = [];
                  res.json({
                        status: 'success',
                        message: 'دریافت همه داده‌های اسلایدر',
                        data: {
                              slider: {
                                    products: sliderProducts,
                                    categories: sliderCategories,
                              },
                              new: {
                                    products: newProducts,
                                    categories: newCategories,
                              },
                              best,
                        },
                  });
            } catch (err: any) {
                  res.status(400).json({
                        status: 'error',
                        message: err.message,
                        data: null,
                  });
            }
      }

      // --- SimpleSliderInfo CRUD ---
      static async addSimpleSliderInfo(req: Request, res: Response) {
            try {
                  const { title, subtitle, link, img } = req.body;
                  if (!title) {
                        return res.status(400).json({ status: 'error', message: 'title is required', data: null });
                  }
                  const item = await SimpleSliderInfoService.add({ title, subtitle, link, img });
                  res.status(201).json({ status: 'success', message: 'آیتم با موفقیت اضافه شد', data: item });
            } catch (err: any) {
                  res.status(400).json({ status: 'error', message: err.message, data: null });
            }
      }
      static async getSimpleSliderInfoById(req: Request, res: Response) {
            try {
                  const { id } = req.params;
                  const item = await SimpleSliderInfoService.getById(id);
                  if (!item) {
                        return res.status(404).json({ status: 'error', message: 'آیتم پیدا نشد', data: null });
                  }
                  res.json({ status: 'success', message: 'آیتم یافت شد', data: item });
            } catch (err: any) {
                  res.status(400).json({ status: 'error', message: err.message, data: null });
            }
      }
      static async getSimpleSliderInfo(_req: Request, res: Response) {
            try {
                  const items = await SimpleSliderInfoService.list();
                  res.json({ status: 'success', message: 'لیست آیتم‌ها', data: items });
            } catch (err: any) {
                  res.status(400).json({ status: 'error', message: err.message, data: null });
            }
      }
      static async updateSimpleSliderInfo(req: Request, res: Response) {
            try {
                  const { id } = req.params;
                  const { title, subtitle, link, img } = req.body;
                  const item = await SimpleSliderInfoService.update(id, { title, subtitle, link, img });
                  res.json({ status: 'success', message: 'آیتم با موفقیت ویرایش شد', data: item });
            } catch (err: any) {
                  res.status(400).json({ status: 'error', message: err.message, data: null });
            }
      }
      static async deleteSimpleSliderInfo(req: Request, res: Response) {
            try {
                  const { id } = req.params;
                  await SimpleSliderInfoService.remove(id);
                  res.json({ status: 'success', message: 'آیتم با موفقیت حذف شد', data: null });
            } catch (err: any) {
                  res.status(400).json({ status: 'error', message: err.message, data: null });
            }
      }
}
