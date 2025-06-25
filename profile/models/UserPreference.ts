import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './sequelize.js';

interface UserPreferenceAttributes {
  id: number;
  userId: number;
  key: string; // e.g. 'favorite_category', 'favorite_brand'
  value: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserPreferenceCreationAttributes extends Optional<UserPreferenceAttributes, 'id'> {}

class UserPreference extends Model<UserPreferenceAttributes, UserPreferenceCreationAttributes> implements UserPreferenceAttributes {
  public id!: number;
  public userId!: number;
  public key!: string;
  public value!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserPreference.init(
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
    modelName: 'UserPreference',
    tableName: 'user_preferences',
  }
);

export default UserPreference; 