import 'dotenv/config';
import '../../../cwd.js';
import '../../../asyncHandler.js';

import express from 'express';
import { headMiddleware } from '../../headMidd.js';
import { categoriesRouter } from './index.js';
import mongoose from 'mongoose';

const PORT = 7011;

const app = express();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/product_db';

async function connectToMongo() {
      await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
      });
      console.log('MongoDB connected for categories worker');
}

await connectToMongo();

headMiddleware(app, express);

app.use('/api/product/v2/categories', categoriesRouter);

app.listen(PORT, () => {
      console.log(`Categories worker running on port ${PORT}`);
      console.log(`Swagger documentation available at http://localhost:${PORT}/api/product/v2/categories/api-docs`);
});

function free() {
      process.exit(0);
}

process.on('beforeExit', () => {
      free();
});
process.on('SIGINT', () => {
      free();
});
process.on('SIGTERM', () => {
      free();
});
process.on('SIGQUIT', () => {
      free();
});
