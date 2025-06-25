import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './sequelize.js';

interface UserSettingAttributes {
  id: number;
  userId: number;
  key: string;
  value: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserSettingCreationAttributes extends Optional<UserSettingAttributes, 'id'> {}

class UserSetting extends Model<UserSettingAttributes, UserSettingCreationAttributes> implements UserSettingAttributes {
  public id!: number;
  public userId!: number;
  public key!: string;
  public value!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserSetting.init(
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
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'UserSetting',
    tableName: 'user_settings',
  }
);

export default UserSetting; 