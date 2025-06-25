import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from './sequelize.js';

interface FavoriteAttributes {
      id: number;
      userId: number;
      itemId: number;
      itemType: string;
      createdAt?: Date;
      updatedAt?: Date;
}

interface FavoriteCreationAttributes extends Optional<FavoriteAttributes, 'id'> {}

class Favorite extends Model<FavoriteAttributes, FavoriteCreationAttributes> implements FavoriteAttributes {
      public id!: number;
      public userId!: number;
      public itemId!: number;
      public itemType!: string;
      public readonly createdAt!: Date;
      public readonly updatedAt!: Date;
}

Favorite.init(
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
            itemId: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
            },
            itemType: {
                  type: DataTypes.STRING,
                  allowNull: false,
            },
      },
      {
            sequelize,
            modelName: 'Favorite',
            tableName: 'favorites',
      }
);

export default Favorite;
