import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './sequelize.js';

interface UserDeviceAttributes {
  id: number;
  userId: number;
  deviceId: string;
  deviceType: string;
  lastLogin: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserDeviceCreationAttributes extends Optional<UserDeviceAttributes, 'id'> {}

class UserDevice extends Model<UserDeviceAttributes, UserDeviceCreationAttributes> implements UserDeviceAttributes {
  public id!: number;
  public userId!: number;
  public deviceId!: string;
  public deviceType!: string;
  public lastLogin!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserDevice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    deviceId: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    deviceType: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'UserDevice',
    tableName: 'user_devices',
  }
);

export default UserDevice; 