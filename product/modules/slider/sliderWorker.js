import 'dotenv/config';
import '../../../cwd.js';
import '../../../asyncHandler.js';
import '../products/models/product.model.js';
import '../categories/models/category.model.js';

import express from 'express';
import { headMiddleware } from '../../headMidd.js';
import sliderRouter from './index.js';
import mongoose from 'mongoose';
import { load } from 'cheerio';
import axios from 'axios';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const PORT = 7101;

const app = express();
const swaggerEndPoint = "/api-docs";

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/product_db';

async function connectToMongo() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
  console.log('MongoDB connected for slider worker');
}

let swaggerPublicHtml = null;
let swaggerPublicError = null;

async function generateSwaggerPublicHtml() {
  try {
    const internalUrl = `http://localhost:${PORT}${swaggerEndPoint}`;
    const response = await axios.get(internalUrl);
    let html = response.data;
    const $ = load(html);

    // Inline <link rel="stylesheet" href="...">
    const linkPromises = [];
    $('link[rel="stylesheet"][href]').each((i, el) => {
      const href = $(el).attr('href');
      let assetUrl = href;
      if (!/^https?:/.test(href)) {
        assetUrl = `http://localhost:${PORT}${swaggerEndPoint}/${href.replace(/^\//, '')}`;
      }
      linkPromises.push(
        axios.get(assetUrl).then(resp => {
          $(el).replaceWith(`<style>${resp.data}</style>`);
        }).catch(() => {
          $(el).remove();
        })
      );
    });

    // Inline <script src="...">
    const scriptPromises = [];
    $('script[src]').each((i, el) => {
      const src = $(el).attr('src');
      let assetUrl = src;
      if (!/^https?:/.test(src)) {
        assetUrl = `http://localhost:${PORT}${swaggerEndPoint}/${src.replace(/^\//, '')}`;
      }
      scriptPromises.push(
        axios.get(assetUrl).then(resp => {
          $(el).replaceWith(`<script>${resp.data}</script>`);
        }).catch(() => {
          $(el).remove();
        })
      );
    });

    await Promise.all([...linkPromises, ...scriptPromises]);
    swaggerPublicHtml = $.html();
    swaggerPublicError = null;
    console.log('Swagger public HTML inlined and cached.');
  } catch (err) {
    swaggerPublicHtml = null;
    swaggerPublicError = err;
    console.error('Failed to inline Swagger UI at startup:', err);
  }
}

await connectToMongo();

// Serve fully inlined Swagger UI HTML at /swagger-public/
app.get('/swagger-public', async (req, res) => {
  try {
    if (swaggerPublicHtml) {
      res.send(swaggerPublicHtml);
    } else {
      res.status(500).send('Swagger UI not available.' + (swaggerPublicError ? ' ' + swaggerPublicError : ''));
    }
  } catch (err) {
    res.status(500).send('Failed to load Swagger UI');
  }
});

headMiddleware(app, express);

const swaggerDocument = YAML.load(cwd('product/modules/slider/swagger.yaml'));

app.use(swaggerEndPoint, swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/', sliderRouter);

app.listen(PORT, () => {
  console.log(`Slider worker running on port ${PORT}`);
  setTimeout(async () => {
    await generateSwaggerPublicHtml();
}, 8000);
}); 