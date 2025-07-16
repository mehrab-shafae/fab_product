import { Router } from 'express';
import * as minioController from './minioController.js';
import fileUpload from 'express-fileupload';

const router = Router();

// Log all incoming requests to this router
router.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', req.body);
    }
    if (req.files) {
        console.log('Files:', Object.keys(req.files));
    }
    next();
});

router.post('/upload', fileUpload(), async (req, res, next) => {
    try {
        await minioController.minioController.upload(req, res);
    } catch (err) {
        console.error('Error in /upload:', err);
        next(err);
    }
});

router.get('/download/:id', async (req, res, next) => {
    try {
        await minioController.minioController.downloadFile(req, res);
    } catch (err) {
        console.error('Error in /download/:id:', err);
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        await minioController.minioController.getFile(req, res);
    } catch (err) {
        console.error('Error in /:id:', err);
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        await minioController.minioController.listFiles(req, res);
    } catch (err) {
        console.error('Error in /:', err);
        next(err);
    }
});

export default router;
