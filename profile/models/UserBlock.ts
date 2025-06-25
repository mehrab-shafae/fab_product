import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './sequelize.js';

interface UserBlockAttributes {
  id: number;
  userId: number;
  blockedUserId?: number;
  blockedItemId?: number;
  blockedItemType?: string;
  createdAt?: Date;
}

interface UserBlockCreationAttributes extends Optional<UserBlockAttributes, 'id' | 'createdAt'> {}

class UserBlock extends Model<UserBlockAttributes, UserBlockCreationAttributes> implements UserBlockAttributes {
  public id!: number;
  public userId!: number;
  public blockedUserId?: number;
  public blockedItemId?: number;
  public blockedItemType?: string;
  public readonly createdAt!: Date;
}

UserBlock.init(
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
    blockedUserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    blockedItemId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    blockedItemType: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'UserBlock',
    tableName: 'user_blocks',
    updatedAt: false,
    timestamps: true,
    createdAt: 'createdAt',
  }
);

export default UserBlock; 