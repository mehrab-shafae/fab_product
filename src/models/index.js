import sequelize from './config.js';
import Category from './Category.js';

// Initialize all models
const models = {
    Category
};

// Export models and sequelize instance
export {
    sequelize,
    Category
};

export default models; 