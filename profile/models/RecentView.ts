import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './index.js';

interface RecentViewAttributes {
  id: number;
  userId: number;
  itemId: number;
  itemType: string;
  viewedAt?: Date;
}

interface RecentViewCreationAttributes extends Optional<RecentViewAttributes, 'id' | 'viewedAt'> {}

class RecentView extends Model<RecentViewAttributes, RecentViewCreationAttributes> implements RecentViewAttributes {
  public id!: number;
  public userId!: number;
  public itemId!: number;
  public itemType!: string;
  public viewedAt!: Date;
}

RecentView.init(
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
    itemId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    itemType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'RecentView',
    tableName: 'recent_views',
    timestamps: false,
  }
);

export default RecentView; 