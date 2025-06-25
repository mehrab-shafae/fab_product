import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './index.js';

interface UserActivityLogAttributes {
  id: number;
  userId: number;
  action: string;
  meta?: object;
  createdAt?: Date;
}

interface UserActivityLogCreationAttributes extends Optional<UserActivityLogAttributes, 'id' | 'createdAt'> {}

class UserActivityLog extends Model<UserActivityLogAttributes, UserActivityLogCreationAttributes> implements UserActivityLogAttributes {
  public id!: number;
  public userId!: number;
  public action!: string;
  public meta?: object;
  public readonly createdAt!: Date;
}

UserActivityLog.init(
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
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'UserActivityLog',
    tableName: 'user_activity_logs',
    updatedAt: false,
    timestamps: true,
    createdAt: 'createdAt',
  }
);

export default UserActivityLog; 