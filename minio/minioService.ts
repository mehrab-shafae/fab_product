import { Client as MinioClient } from 'minio';
import * as path from 'path';
import FileUpload from './FileUpload.js';
import { UploadedFile } from 'express-fileupload';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';

const minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
});

const BUCKET = process.env.MINIO_BUCKET || 'uploads';

async function checkMinioConnectionAndBucket() {
      try {
            console.log('[minioService] Checking MinIO connection and bucket...');
            // Try listing buckets to check credentials
            const buckets = await minioClient.listBuckets();
            console.log(
                  '[minioService] Buckets found:',
                  buckets.map(b => b.name)
            );
            // Check if our bucket exists
            const exists = await minioClient.bucketExists(BUCKET);
            if (!exists) {
                  console.warn(`[minioService] Bucket '${BUCKET}' does not exist. Will attempt to create on demand.`);
            } else {
                  console.log(`[minioService] Bucket '${BUCKET}' exists.`);
            }
            return true;
      } catch (err: any) {
            console.error('[minioService] MinIO connection or credentials error:', err);
            throw new Error('Cannot connect to MinIO: ' + (err && err.message ? err.message : err));
      }
}

async function ensureBucketExists(bucket: string) {
      try {
            const exists = await minioClient.bucketExists(bucket);
            if (!exists) {
                  await minioClient.makeBucket(bucket, 'us-east-1');
            }
      } catch (err: any) {
            console.error('[minioService.ensureBucketExists] Error:', err);
            throw new Error('Cannot access or create bucket: ' + (err && err.message ? err.message : err));
      }
}

export const minioService = {
      checkMinioConnectionAndBucket,
      async uploadFile(file: UploadedFile) {
            console.log('[minioService.uploadFile] called, file:', file.name, 'size:', file.size);
            if (file.size > 10 * 1024 * 1024) {
                  console.log('[minioService.uploadFile] File too large');
                  throw new Error('File size exceeds 10MB limit.');
            }
            try {
                  console.log('[minioService.uploadFile] Ensuring bucket exists:', BUCKET);
                  await ensureBucketExists(BUCKET);
                  console.log('[minioService.uploadFile] Bucket ready');
                  const uuid = uuidv4();
                  const ext = path.extname(file.name);
                  const objectName = `${uuid}${ext}`;
                  console.log('[minioService.uploadFile] Uploading to MinIO:', objectName);
                  await minioClient.putObject(BUCKET, objectName, file.data, file.size, {
                        'Content-Type': file.mimetype,
                  });
                  console.log('[minioService.uploadFile] Uploaded to MinIO:', objectName);
                  const url = `/minio/${BUCKET}/${objectName}`;
                  console.log('[minioService.uploadFile] Creating DB record');
                  const fileRecord = await FileUpload.create({
                        originalName: file.name,
                        size: file.size,
                        mimeType: file.mimetype,
                        bucket: BUCKET,
                        objectName,
                        url,
                  });
                  console.log('[minioService.uploadFile] DB record created:', fileRecord._id);
                  return fileRecord;
            } catch (err) {
                  console.error('[minioService.uploadFile] Error:', err);
                  throw err;
            }
      },

      async getFileInfo(id: string) {
            if (!Types.ObjectId.isValid(id)) return null;
            return FileUpload.findById(id);
      },

      async streamFileById(id: string, res: any) {
            if (!Types.ObjectId.isValid(id)) throw new Error('File not found');
            const file = await FileUpload.findById(id);
            if (!file) throw new Error('File not found');
            const stream = await minioClient.getObject(file.bucket, file.objectName);
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
            stream.pipe(res);
      },

      async listFiles(limit = 20, offset = 0) {
            const files = await FileUpload.find().sort({ createdAt: -1 }).skip(offset).limit(limit).exec();
            const count = await FileUpload.countDocuments();
            return { rows: files, count };
      },

      async deleteFile(id: string) {
            if (!Types.ObjectId.isValid(id)) throw new Error('Invalid file id');
            const file = await FileUpload.findById(id);
            if (!file) throw new Error('File not found');
            // Delete from Minio
            await minioClient.removeObject(file.bucket, file.objectName);
            // Delete from DB
            await FileUpload.deleteOne({ _id: id });
            return { id };
      },

      async deleteFiles(ids: string[]) {
            if (!Array.isArray(ids) || ids.length === 0) throw new Error('No file ids provided');
            // Find all files
            const files = await FileUpload.find({ _id: { $in: ids } });
            if (!files || files.length === 0) throw new Error('No files found');
            // Delete from Minio (batch)
            const objects = files.map(f => ({ bucket: f.bucket, objectName: f.objectName, id: f._id }));
            for (const obj of objects) {
                  await minioClient.removeObject(obj.bucket, obj.objectName);
            }
            // Delete from DB
            await FileUpload.deleteMany({ _id: { $in: ids } });
            return { deleted: ids };
      },
};
