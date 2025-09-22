import { Request, Response } from 'express';
import { discountsService } from '../services/discounts.service.js';

export const create = async (req: Request, res: Response) => {
      try {
            const discount = await discountsService.create(req.body);
            res.status(201).json({ status: 'success', data: { discount }, message: 'کد تخفیف با موفقیت ایجاد شد' });
      } catch (err) {
            const errorMessage = (err as Error).message;
            // Check if it's a validation error
            if (errorMessage.includes('محصولات نامعتبر')) {
                  res.status(400).json({ status: 'error', message: errorMessage });
            } else {
                  res.status(400).json({ status: 'error', message: errorMessage });
            }
      }
};

export const bulk = async (req: Request, res: Response) => {
      try {
            const discounts = await discountsService.bulkCreate(req.body);
            res.status(201).json({ status: 'success', data: { discounts }, message: 'کدهای تخفیف با موفقیت ایجاد شدند' });
      } catch (err) {
            const errorMessage = (err as Error).message;
            // Check if it's a validation error
            if (errorMessage.includes('محصولات نامعتبر')) {
                  res.status(400).json({ status: 'error', message: errorMessage });
            } else {
                  res.status(400).json({ status: 'error', message: errorMessage });
            }
      }
};

export const list = async (_: Request, res: Response) => {
      const discounts = await discountsService.list();
      res.json({ status: 'success', data: { discounts } });
};

export const get = async (req: Request, res: Response) => {
      try {
            const discount = await discountsService.getById(req.params.id);
            if (!discount) return res.status(404).json({ status: 'error', message: 'کد تخفیف پیدا نشد' });
            res.json({ status: 'success', data: { discount } });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const update = async (req: Request, res: Response) => {
      try {
            const discount = await discountsService.update(req.params.id, req.body);
            if (!discount) return res.status(404).json({ status: 'error', message: 'کد تخفیف پیدا نشد' });
            res.json({ status: 'success', data: { discount } });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const remove = async (req: Request, res: Response) => {
      try {
            const discount = await discountsService.remove(req.params.id);
            if (!discount) return res.status(404).json({ status: 'error', message: 'کد تخفیف پیدا نشد' });
            res.json({ status: 'success', message: 'کد تخفیف حذف شد' });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const statusByCode = async (req: Request, res: Response) => {
      const result = await discountsService.statusByCode(req.params.code);
      if (!result) return res.status(404).json({ status: 'error', message: 'کد تخفیف پیدا نشد' });
      res.json({ status: 'success', data: result });
};

export const apply = async (req: Request, res: Response) => {
      try {
            const { code, userId, productIds, orderId } = req.body;
            const applied = await discountsService.apply(code, userId, productIds, orderId);
            res.json({ status: 'success', data: { message: 'کد تخفیف اعمال شد', discount: applied } });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const getDetailedStatus = async (req: Request, res: Response) => {
      try {
            const { code } = req.params;
            const result = await discountsService.getDetailedStatus(code);
            res.json({ status: 'success', data: result });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const getUsageHistory = async (req: Request, res: Response) => {
      try {
            const { code } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const result = await discountsService.getUsageHistory(code, Number(page), Number(limit));
            res.json({ status: 'success', data: result });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const updateStatus = async (req: Request, res: Response) => {
      try {
            const { id } = req.params;
            const { active } = req.body;
            const discount = await discountsService.updateStatus(id, active);
            if (!discount) return res.status(404).json({ status: 'error', message: 'کد تخفیف پیدا نشد' });
            res.json({ status: 'success', data: { discount }, message: 'وضعیت کد تخفیف به‌روزرسانی شد' });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const getDiscountsWithFilters = async (req: Request, res: Response) => {
      try {
            const { active, productMode, userMode, type, page = 1, limit = 10 } = req.query;
            const filters = {
                  active: active ? active === 'true' : undefined,
                  productMode: productMode as any,
                  userMode: userMode as any,
                  type: type as string,
                  page: Number(page),
                  limit: Number(limit)
            };
            const result = await discountsService.getDiscountsWithFilters(filters);
            res.json({ status: 'success', data: result });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};
