const express = require('express');
const router = express.Router();
const Discount = require('../models/Discount');
const { makeResponse } = require('../response');

/**
 * @swagger
 * components:
 *   schemas:
 *     Discount:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         type:
 *           type: string
 *           enum: [percentage, fixed]
 *         value:
 *           type: number
 *         expiry:
 *           type: string
 *           format: date-time
 *         maxUsage:
 *           type: integer
 *         usedCount:
 *           type: integer
 *         active:
 *           type: boolean
 *         productIds:
 *           type: array
 *           items:
 *             type: string
 *         userIds:
 *           type: array
 *           items:
 *             type: string
 */

// افزودن کد تخفیف تکی
/**
 * @swagger
 * /discounts:
 *   post:
 *     summary: ایجاد کد تخفیف جدید
 *     tags: [Discounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Discount'
 *     responses:
 *       201:
 *         description: Discount created
 *       400:
 *         description: Bad request
 */
router.post('/', async (req, res) => {
  try {
    const discount = new Discount(req.body);
    await discount.save();
    res.status(201).json(makeResponse('success', { discount }));
  } catch (err) {
    res.status(400).json({ status: 'error', data: { message: err.message } });
  }
});

// افزودن دسته‌ای کد تخفیف
/**
 * @swagger
 * /discounts/bulk:
 *   post:
 *     summary: ایجاد کدهای تخفیف دسته‌جمعی
 *     tags: [Discounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/Discount'
 *     responses:
 *       201:
 *         description: Discounts created
 *       400:
 *         description: Bad request
 */
router.post('/bulk', async (req, res) => {
  try {
    const discounts = await Discount.insertMany(req.body);
    res.status(201).json(makeResponse('success', { discounts }));
  } catch (err) {
    res.status(400).json({ status: 'error', data: { message: err.message } });
  }
});

// لیست همه تخفیف‌ها
/**
 * @swagger
 * /discounts:
 *   get:
 *     summary: لیست تمام تخفیف‌ها برای ادمین
 *     tags: [Discounts]
 *     responses:
 *       200:
 *         description: List of discounts
 */
router.get('/', async (req, res) => {
  const discounts = await Discount.find();
  res.json(makeResponse('success', { discounts }));
});

// دریافت جزئیات یک کد تخفیف خاص
/**
 * @swagger
 * /discounts/status/{code}:
 *   get:
 *     summary: دریافت وضعیت یک کد تخفیف خاص
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: discount code
 *     responses:
 *       200:
 *         description: Discount status
 *       404:
 *         description: Not found
 */
router.get('/status/:code', async (req, res) => {
  const discount = await Discount.findOne({ code: req.params.code });
  if (!discount) return res.status(404).json({ status: 'error', data: { message: 'کد تخفیف پیدا نشد' } });
  let statusMsg = 'کد معتبر است';
  if (!discount.active) statusMsg = 'کد غیرفعال است';
  else if (discount.expiry < new Date()) statusMsg = 'کد تخفیف منقضی شده است';
  else if (discount.usedCount >= discount.maxUsage) statusMsg = 'تعداد استفاده تمام شده است';
  res.json(makeResponse('success', { discount, status: statusMsg }));
});

// دریافت جزئیات با آیدی (برای نمایش جزئیات در لیست)
router.get('/:id', async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);
    if (!discount) return res.status(404).json({ status: 'error', data: { message: 'کد تخفیف پیدا نشد' } });
    res.json(makeResponse('success', { discount }));
  } catch (err) {
    res.status(400).json({ status: 'error', data: { message: err.message } });
  }
});

// ویرایش کد تخفیف
/**
 * @swagger
 * /discounts/{id}:
 *   patch:
 *     summary: ویرایش تخفیف
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: discount id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Discount'
 *     responses:
 *       200:
 *         description: Discount updated
 *       404:
 *         description: Not found
 */
router.patch('/:id', async (req, res) => {
  try {
    const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!discount) return res.status(404).json({ status: 'error', data: { message: 'کد تخفیف پیدا نشد' } });
    res.json(makeResponse('success', { discount }));
  } catch (err) {
    res.status(400).json({ status: 'error', data: { message: err.message } });
  }
});

// حذف کد تخفیف
/**
 * @swagger
 * /discounts/{id}:
 *   delete:
 *     summary: حذف تخفیف
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: discount id
 *     responses:
 *       200:
 *         description: Discount deleted
 *       404:
 *         description: Not found
 */
router.delete('/:id', async (req, res) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    if (!discount) return res.status(404).json({ status: 'error', data: { message: 'کد تخفیف پیدا نشد' } });
    res.json(makeResponse('success', { message: 'کد تخفیف حذف شد' }));
  } catch (err) {
    res.status(400).json({ status: 'error', data: { message: err.message } });
  }
});

// اعمال کد تخفیف
/**
 * @swagger
 * /discounts/apply:
 *   post:
 *     summary: اعمال کد تخفیف برای بررسی و کم‌کردن از تعداد
 *     tags: [Discounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               userId:
 *                 type: string
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Discount applied
 *       400:
 *         description: Invalid discount
 */
router.post('/apply', async (req, res) => {
  const { code, userId, productIds } = req.body;
  const discount = await Discount.findOne({ code });
  if (!discount) return res.status(400).json({ status: 'error', data: { message: 'کد تخفیف پیدا نشد' } });
  if (!discount.active) return res.status(400).json({ status: 'error', data: { message: 'کد غیرفعال است' } });
  if (discount.expiry < new Date()) return res.status(400).json({ status: 'error', data: { message: 'کد تخفیف منقضی شده است' } });
  if (discount.usedCount >= discount.maxUsage) return res.status(400).json({ status: 'error', data: { message: 'تعداد استفاده تمام شده است' } });
  if (discount.userIds.length && (!userId || !discount.userIds.includes(userId)))
    return res.status(400).json({ status: 'error', data: { message: 'کد تخفیف برای این کاربر مجاز نیست' } });
  if (discount.productIds.length && (!productIds || !productIds.some(pid => discount.productIds.includes(pid))))
    return res.status(400).json({ status: 'error', data: { message: 'کد تخفیف برای این محصولات مجاز نیست' } });
  // اعمال تخفیف روی محصولات واجد شرایط
  let appliedProducts = productIds && discount.productIds.length
    ? productIds.filter(pid => discount.productIds.includes(pid))
    : productIds;
  // کم کردن یک عدد از maxUsage
  discount.usedCount += 1;
  await discount.save();
  res.json(makeResponse('success', {
    message: 'کد تخفیف با موفقیت اعمال شد',
    discount: {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      appliedProducts,
      userId,
    },
  }));
});

module.exports = router;