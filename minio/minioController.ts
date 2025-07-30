import { Request, Response } from 'express';
import { minioService } from './minioService.js';
import { UploadedFile } from 'express-fileupload';

export const minioController = {
      async upload(req: Request, res: Response) {
            console.log('[minioController.upload] called');
            try {
                  const files = req.files as { file?: UploadedFile | UploadedFile[] } | undefined;
                  if (!files || !files.file) {
                        console.log('[minioController.upload] No file uploaded');
                        return res.status(400).json({ message: 'No file uploaded.', status: 'error' });
                  }
                  const file = Array.isArray(files.file) ? files.file[0] : files.file;
                  const fileRecord = await minioService.uploadFile(file);
                  console.log('[minioController.upload] File uploaded:', fileRecord._id);
                  res.status(201).json({ data: fileRecord, status: 'success' });
            } catch (err: any) {
                  console.error('[minioController.upload] Error:', err);
                  if (err.message && err.message.includes('File size exceeds')) {
                        return res.status(413).json({ message: err.message, status: 'error' });
                  }
                  res.status(500).json({ message: 'Upload failed', status: 'error' });
            }
      },

      async getFile(req: Request, res: Response) {
            console.log('[minioController.getFile] called, id:', req.params.id);
            try {
                  const id = req.params.id;
                  const file = await minioService.getFileInfo(id);
                  if (!file) {
                        console.log('[minioController.getFile] File not found');
                        return res.status(404).json({ message: 'File not found', status: 'error' });
                  }
                  res.json({ data: file, status: 'success' });
            } catch (err) {
                  console.error('[minioController.getFile] Error:', err);
                  res.status(500).json({ message: 'Error fetching file', status: 'error' });
            }
      },

      async downloadFile(req: Request, res: Response) {
            console.log('[minioController.downloadFile] called, id:', req.params.id);
            try {
                  const id = req.params.id;
                  await minioService.streamFileById(id, res);
                  console.log('[minioController.downloadFile] Streamed file');
            } catch (err) {
                  console.error('[minioController.downloadFile] Error:', err);
                  res.status(404).json({ message: 'File not found or error streaming file', status: 'error' });
            }
      },

      async listFiles(req: Request, res: Response) {
            console.log('[minioController.listFiles] called');
            try {
                  const limit = Number(req.query.limit) || 20;
                  const offset = Number(req.query.offset) || 0;
                  const { rows, count } = await minioService.listFiles(limit, offset);
                  res.json({ data: { rows, count }, status: 'success' });
            } catch (err) {
                  console.error('[minioController.listFiles] Error:', err);
                  res.status(500).json({ message: 'Error listing files', status: 'error' });
            }
      },

      async deleteFile(req: Request, res: Response) {
            console.log('[minioController.deleteFile] called, id:', req.params.id);
            try {
                  const id = req.params.id;
                  const result = await minioService.deleteFile(id);
                  res.json({ data: result, status: 'success' });
            } catch (err: any) {
                  console.error('[minioController.deleteFile] Error:', err);
                  res.status(404).json({ message: err.message || 'File not found or error deleting file', status: 'error' });
            }
      },

      async deleteFiles(req: Request, res: Response) {
            console.log('[minioController.deleteFiles] called');
            try {
                  const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : [];
                  const result = await minioService.deleteFiles(ids);
                  res.json({ data: result, status: 'success' });
            } catch (err: any) {
                  console.error('[minioController.deleteFiles] Error:', err);
                  res.status(400).json({ message: err.message || 'Error deleting files', status: 'error' });
            }
      },
};
