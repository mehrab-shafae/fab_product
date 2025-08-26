import { Router } from 'express';
import * as controller from '../controllers/discounts.controller.js';

const router = Router();

router.post('/', controller.create);
router.post('/bulk', controller.bulk);
router.get('/', controller.list);
router.get('/status/:code', controller.statusByCode);
router.get('/:id', controller.get);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/apply', controller.apply);

export default router;


