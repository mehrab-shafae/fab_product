import { Router } from 'express';
import { SliderController } from '../controllers/slider.controller.js';

const router = Router();

// افزودن محصول به slider
router.post('/products', SliderController.addProductToSlider);
// افزودن دسته‌بندی به slider
router.post('/categories', SliderController.addCategoryToSlider);
// حذف آیتم از slider
router.delete('/slider/:id', SliderController.removeSliderItem);
// لیست محصولات slider
router.get('/products', SliderController.listSliderProducts);
// لیست دسته‌بندی‌های slider
router.get('/categories', SliderController.listSliderCategories);
// جدیدترین محصولات با sort و paging
router.get('/new/products', SliderController.newProducts);
// جدیدترین دسته‌بندی‌ها با sort و paging
router.get('/new/categories', SliderController.newCategories);
// اسکلت best (فعلاً خالی)
router.get('/best', SliderController.best);
// دریافت همه داده‌های slider، new و best
router.get('/all', SliderController.getAll);

// --- SimpleSliderInfo CRUD ---
router.post('/', SliderController.addSimpleSliderInfo);
router.get('/', SliderController.getSimpleSliderInfo);
router.put('/:id', SliderController.updateSimpleSliderInfo);
router.delete('/:id', SliderController.deleteSimpleSliderInfo);

export default router;
