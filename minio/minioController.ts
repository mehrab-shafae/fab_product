import { Request, Response } from 'express';
import { minioService } from './minioService.js';
import { UploadedFile } from 'express-fileupload';

export const minioController = {
  async upload(req: Request, res: Response) {
    try {
      const files = req.files as { file?: UploadedFile | UploadedFile[] } | undefined;
      if (!files || !files.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
      }
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const fileRecord = await minioService.uploadFile(file);
      res.status(201).json(fileRecord);
    } catch (err: any) {
      if (err.message && err.message.includes('File size exceeds')) {
        return res.status(413).json({ message: err.message });
      }
      res.status(500).json({ message: 'Upload failed', error: err });
    }
  },

  async getFile(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const file = await minioService.getFileInfo(id);
      if (!file) return res.status(404).json({ message: 'File not found' });
      res.json(file);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching file', error: err });
    }
  },

  async downloadFile(req: Request, res: Response) {
    try {
      const id = req.params.id;
      await minioService.streamFileById(id, res);
    } catch (err) {
      res.status(404).json({ message: 'File not found or error streaming file', error: err });
    }
  },

  async listFiles(req: Request, res: Response) {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const files = await minioService.listFiles(limit, offset);
      res.json(files);
    } catch (err) {
      res.status(500).json({ message: 'Error listing files', error: err });
    }
  },
}; 