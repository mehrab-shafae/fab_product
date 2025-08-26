import { Router } from 'express';
import * as ordersController from '../controllers/orders.controller.js';
import { validateCreateOrder, validateUpdateOrder, validateUpdateOrderStatus, checkOrderExists, checkProductsExist } from '../middlewares/orderMiddleware.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const router = Router();
const swaggerDocument = YAML.load(cwd('product/modules/orders/swagger.yaml'));

router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// CRUD
router.post('/', validateCreateOrder, checkProductsExist, ordersController.createOrder);
router.get('/', ordersController.getAllOrders);
router.get('/users/:userId', ordersController.getOrdersByUser);
router.get('/:id', checkOrderExists, ordersController.getOrderById);
router.patch('/:id/status', validateUpdateOrderStatus, checkOrderExists, ordersController.updateOrderStatus);
router.put('/:id', validateUpdateOrder, checkOrderExists, ordersController.updateOrder);
router.delete('/:id', checkOrderExists, ordersController.deleteOrder);
router.get('/stats', ordersController.getOrderStats);

export default router;
