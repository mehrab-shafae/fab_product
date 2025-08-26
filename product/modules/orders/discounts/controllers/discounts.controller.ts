import { Request, Response } from 'express';
import { discountsService } from '../services/discounts.service.js';

export const create = async (req: Request, res: Response) => {
      try {
            const discount = await discountsService.create(req.body);
            res.status(201).json({ status: 'success', data: { discount } });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};

export const bulk = async (req: Request, res: Response) => {
      try {
            const discounts = await discountsService.bulkCreate(req.body);
            res.status(201).json({ status: 'success', data: { discounts } });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
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
            const { code, userId, productIds } = req.body;
            const applied = await discountsService.apply(code, userId, productIds);
            res.json({ status: 'success', data: { message: 'کد تخفیف اعمال شد', discount: applied } });
      } catch (err) {
            res.status(400).json({ status: 'error', message: (err as Error).message });
      }
};


