import mongoose from 'mongoose';

/**
 * @deprecated
 */
export const connectMongo = async (mongoUri: string) => {
      try {
            await mongoose.connect(mongoUri, {
                  // useNewUrlParser: true,
                  // useUnifiedTopology: true,
                  autoIndex: true,
            } as any);
            console.log('MongoDB connected for Product module');

            // Ensure indexes are synchronized so schema-level indexes (including partial/unique) are actually created
            try {
                  const { Product } = await import('./product.model.js');
                  await Product.syncIndexes();
                  console.log('Product indexes synchronized');
            } catch (indexErr) {
                  console.error('Failed to sync Product indexes:', indexErr);
            }
      } catch (error: any) {
            console.error('MongoDB connection error:', error);
            process.exit(1);
      }
};

// Export models
export { Product } from './product.model.js';
export { User } from './user.model.js';
