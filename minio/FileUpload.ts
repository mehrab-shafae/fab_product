import mongoose, { Schema, Document } from 'mongoose';

export interface IFileUpload extends Document {
  originalName: string;
  size: number;
  mimeType: string;
  bucket: string;
  objectName: string;
  url: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const FileUploadSchema = new Schema<IFileUpload>({
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  bucket: { type: String, required: true },
  objectName: { type: String, required: true },
  url: { type: String, required: true },
}, {
  timestamps: true
});

const FileUpload = mongoose.models.FileUpload || mongoose.model<IFileUpload>('FileUpload', FileUploadSchema);

export default FileUpload;
