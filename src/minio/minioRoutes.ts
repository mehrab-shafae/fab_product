import { Router } from 'express';
import * as minioController from './minioController.js';
import fileUpload from 'express-fileupload';

const router = Router();

// Helper to wrap async route handlers
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/upload', fileUpload(), asyncHandler(minioController.minioController.upload));
router.get('/download/:id', asyncHandler(minioController.minioController.downloadFile));
router.get('/:id', asyncHandler(minioController.minioController.getFile));
router.get('/', asyncHandler(minioController.minioController.listFiles));

export default router; 