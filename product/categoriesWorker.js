import express from 'express';
import { headMiddleware } from './headMidd.js';
import { categoriesRouter } from './modules/categories/index.js';

const PORT = 7011;

const app = express();

headMiddleware(app, express);

app.use('/api/product/v2/categories', categoriesRouter);

app.listen(PORT, () => {
  console.log(`Categories worker running on port ${PORT}`);
  console.log(`Swagger documentation available at http://localhost:${PORT}/api/product/v2/categories/api-docs`);
});

function free() {
    setTimeout(() => {
          process.exit(0);
    }, 1000);
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
