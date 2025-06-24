import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../models/config.js';

interface FileUploadAttributes {
  id: string; // UUID
  originalName: string;
  size: number;
  mimeType: string;
  bucket: string;
  objectName: string;
  url: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FileUploadCreationAttributes extends Optional<FileUploadAttributes, 'id'> {}

class FileUpload extends Model<FileUploadAttributes, FileUploadCreationAttributes> implements FileUploadAttributes {
  public id!: string;
  public originalName!: string;
  public size!: number;
  public mimeType!: string;
  public bucket!: string;
  public objectName!: string;
  public url!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FileUpload.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    bucket: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    objectName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'file_uploads',
    timestamps: true,
  }
);

export default FileUpload; 