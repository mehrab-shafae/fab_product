import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './index.js';

interface UserSocialLinkAttributes {
  id: number;
  userId: number;
  platform: string; // e.g. 'instagram', 'telegram', 'linkedin'
  url: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserSocialLinkCreationAttributes extends Optional<UserSocialLinkAttributes, 'id'> {}

class UserSocialLink extends Model<UserSocialLinkAttributes, UserSocialLinkCreationAttributes> implements UserSocialLinkAttributes {
  public id!: number;
  public userId!: number;
  public platform!: string;
  public url!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserSocialLink.init(
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
    platform: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'UserSocialLink',
    tableName: 'user_social_links',
  }
);

export default UserSocialLink; 