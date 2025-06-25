import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './sequelize.js';

interface UserNotificationAttributes {
  id: number;
  userId: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt?: Date;
}

interface UserNotificationCreationAttributes extends Optional<UserNotificationAttributes, 'id' | 'createdAt'> {}

class UserNotification extends Model<UserNotificationAttributes, UserNotificationCreationAttributes> implements UserNotificationAttributes {
  public id!: number;
  public userId!: number;
  public type!: string;
  public message!: string;
  public isRead!: boolean;
  public readonly createdAt!: Date;
}

UserNotification.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    message: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'UserNotification',
    tableName: 'user_notifications',
    updatedAt: false,
    timestamps: true,
    createdAt: 'createdAt',
  }
);

export default UserNotification; 