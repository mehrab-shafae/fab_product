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
                        return res.status(400).json({ message: 'No file uploaded.' });
                  }
                  const file = Array.isArray(files.file) ? files.file[0] : files.file;
                  const fileRecord = await minioService.uploadFile(file);
                  console.log('[minioController.upload] File uploaded:', fileRecord._id);
                  res.status(201).json(fileRecord);
            } catch (err: any) {
                  console.error('[minioController.upload] Error:', err);
                  if (err.message && err.message.includes('File size exceeds')) {
                        return res.status(413).json({ message: err.message });
                  }
                  res.status(500).json({ message: 'Upload failed', error: err });
            }
      },

      async getFile(req: Request, res: Response) {
            console.log('[minioController.getFile] called, id:', req.params.id);
            try {
                  const id = req.params.id;
                  const file = await minioService.getFileInfo(id);
                  if (!file) {
                        console.log('[minioController.getFile] File not found');
                        return res.status(404).json({ message: 'File not found' });
                  }
                  res.json(file);
            } catch (err) {
                  console.error('[minioController.getFile] Error:', err);
                  res.status(500).json({ message: 'Error fetching file', error: err });
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
                  res.status(404).json({ message: 'File not found or error streaming file', error: err });
            }
      },

      async listFiles(req: Request, res: Response) {
            console.log('[minioController.listFiles] called');
            try {
                  const limit = Number(req.query.limit) || 20;
                  const offset = Number(req.query.offset) || 0;
                  const { rows, count } = await minioService.listFiles(limit, offset);
                  res.json({ rows, count });
            } catch (err) {
                  console.error('[minioController.listFiles] Error:', err);
                  res.status(500).json({ message: 'Error listing files', error: err });
            }
      },
};
