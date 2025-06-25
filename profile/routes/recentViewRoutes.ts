import { Router } from 'express';
import * as recentViewController from '../controllers/recentViewController.js';

const router = Router();

router.post('/', recentViewController.add);
router.get('/', recentViewController.list);
router.delete('/', recentViewController.clear);

export default router;
