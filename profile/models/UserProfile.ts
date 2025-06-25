import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './index.js';

export interface UserProfileAttributes {
  id: number;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  avatar_image_id?: string;
  birthdate?: Date;
  gender?: 'male' | 'female' | 'other';
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

export interface UserProfileCreationAttributes extends Optional<UserProfileAttributes, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> {}

class UserProfile extends Model<UserProfileAttributes, UserProfileCreationAttributes> implements UserProfileAttributes {
  public id!: number;
  public user_id!: string;
  public first_name?: string;
  public last_name?: string;
  public email?: string;
  public mobile?: string;
  public avatar_image_id?: string;
  public birthdate?: Date;
  public gender?: 'male' | 'female' | 'other';
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;
}

UserProfile.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    first_name: DataTypes.STRING(100),
    last_name: DataTypes.STRING(100),
    email: DataTypes.STRING(150),
    mobile: DataTypes.STRING(20),
    avatar_image_id: DataTypes.STRING(100),
    birthdate: DataTypes.DATE,
    gender: DataTypes.ENUM('male', 'female', 'other'),
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'user_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default UserProfile; 