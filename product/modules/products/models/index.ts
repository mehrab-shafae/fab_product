import mongoose from 'mongoose';

export const connectMongo = async (mongoUri: string) => {
      try {
            await mongoose.connect(mongoUri, {
                  useNewUrlParser: true,
                  useUnifiedTopology: true,
            } as any);
            console.log('MongoDB connected for Product module');
      } catch (error: any) {
            console.error('MongoDB connection error:', error);
            process.exit(1);
      }
};
