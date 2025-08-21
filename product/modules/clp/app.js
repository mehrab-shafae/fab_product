// app.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const colorRoutes = require('./color.routes');
app.use('/api/v1/colors', colorRoutes);

try {
      const swaggerSpec = swaggerJsdoc({
            definition: { openapi: '3.0.0', info: { title: 'Colors API', version: '1.0.0' } },
            // Only include JS files, explicitly ignore node_modules and dotfolders
            apis: ['./*.js', './models/*.js', './middlewares/*.js', '!./node_modules/**', '!./**/node_modules/**', '!./.*'],
      });
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} catch (e) {
      console.warn('Swagger init failed, continuing without docs:', e?.message);
}

app.use((req, res) => res.status(404).json({ message: 'Not Found' }));
app.use((err, req, res, next) => {
      console.error(err);
      res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const port = parseInt(process.env.COLORS_PORT || '3001', 10);
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/colors_db';

async function start() {
      await mongoose.connect(mongoUri, { autoIndex: true });
      try {
            const Color = require('./models/color.model');
            await Color.syncIndexes();
      } catch (e) {
            console.warn('Index sync warning:', e?.message);
      }
      app.listen(port, () => console.log(`Colors API listening on :${port}`));
}
start().catch(e => {
      console.error('Startup error:', e);
      process.exit(1);
});
