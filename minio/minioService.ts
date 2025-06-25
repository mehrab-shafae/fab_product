import { Client as MinioClient } from 'minio';
import * as path from 'path';
import FileUpload from './FileUpload.js';
import { UploadedFile } from 'express-fileupload';
import { v4 as uuidv4 } from 'uuid';

const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const BUCKET = process.env.MINIO_BUCKET || 'uploads';

async function ensureBucketExists(bucket: string) {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket, 'us-east-1');
  }
}

export const minioService = {
  async uploadFile(file: UploadedFile) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit.');
    }
    await ensureBucketExists(BUCKET);
    const uuid = uuidv4();
    const ext = path.extname(file.name);
    const objectName = `${uuid}${ext}`;
    await minioClient.putObject(BUCKET, objectName, file.data, file.size, {
      'Content-Type': file.mimetype,
    });
    const url = `/minio/${BUCKET}/${objectName}`;
    const fileRecord = await FileUpload.create({
      id: uuid,
      originalName: file.name,
      size: file.size,
      mimeType: file.mimetype,
      bucket: BUCKET,
      objectName,
      url,
    });
    return fileRecord;
  },

  async getFileInfo(id: string) {
    return FileUpload.findByPk(id);
  },

  async streamFileById(id: string, res: any) {
    const file = await FileUpload.findByPk(id);
    if (!file) throw new Error('File not found');
    const stream = await minioClient.getObject(file.bucket, file.objectName);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    stream.pipe(res);
  },

  async listFiles(limit = 20, offset = 0) {
    return FileUpload.findAndCountAll({ limit, offset, order: [['createdAt', 'DESC']] });
  },
}; 