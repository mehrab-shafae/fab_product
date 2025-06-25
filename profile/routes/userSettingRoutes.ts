import { Router } from 'express';
import * as userSettingController from '../controllers/userSettingController.js';

const router = Router();

// ایجاد تنظیم جدید
router.post('/users/:userId/settings', (req, res) => {
      userSettingController.create(req, res).catch(err => {
            res.status(500).json({ error: err.message || 'Internal Server Error' });
      });
});
// لیست تنظیمات کاربر
router.get('/users/:userId/settings', (req, res) => {
      userSettingController.list(req, res).catch(err => {
            res.status(500).json({ error: err.message || 'Internal Server Error' });
      });
});
// ویرایش تنظیم
router.put('/settings/:id', (req, res) => {
      userSettingController.update(req, res).catch(err => {
            res.status(500).json({ error: err.message || 'Internal Server Error' });
      });
});
// حذف تنظیم
router.delete('/settings/:id', (req, res) => {
      userSettingController.remove(req, res).catch(err => {
            res.status(500).json({ error: err.message || 'Internal Server Error' });
      });
});

export default router;
