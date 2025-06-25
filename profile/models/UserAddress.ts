import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './index';

export interface UserAddressAttributes {
  id: number;
  user_id: string;
  title?: string;
  address_line: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  is_default?: boolean;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

export interface UserAddressCreationAttributes extends Optional<UserAddressAttributes, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> {}

class UserAddress extends Model<UserAddressAttributes, UserAddressCreationAttributes> implements UserAddressAttributes {
  public id!: number;
  public user_id!: string;
  public title?: string;
  public address_line!: string;
  public city?: string;
  public province?: string;
  public postal_code?: string;
  public country?: string;
  public is_default?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public deleted_at!: Date | null;
}

UserAddress.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    title: DataTypes.STRING(50),
    address_line: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    city: DataTypes.STRING(100),
    province: DataTypes.STRING(100),
    postal_code: DataTypes.STRING(20),
    country: DataTypes.STRING(100),
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
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
    tableName: 'user_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
  }
);

export default UserAddress; 