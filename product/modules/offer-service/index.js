require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
// const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
// app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/discount-service_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Swagger setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Discount Service API',
      version: '1.0.0',
      description: 'API documentation for Discount Management Service',
    },
    servers: [
      { url: 'http://localhost:3000' },
    ],
  },
  apis: ['./routes/*.js', './index.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routers
app.use('/discounts', require('./routes/discounts'));

app.get('/', (req, res) => {
  res.send('Discount Service is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});