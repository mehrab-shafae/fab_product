import 'dotenv/config';
import '../../../cwd.js';
import '../../../asyncHandler.js';

import express from 'express';
import { headMiddleware } from '../../headMidd.js';
import { productRouter } from './index.js';
import mongoose from 'mongoose';
import { load } from 'cheerio';
import axios from 'axios';

const PORT = 7021;

const app = express();
const swaggerEndPoint = '/api/product/v2/api-docs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/product_db';

async function connectToMongo() {
      await mongoose.connect(MONGO_URI, { autoIndex: true }).catch(err => {
            console.error('MongoDB connection error:', err);
            process.exit(1);
      });
      console.log('MongoDB connected for products worker');

      // Ensure Product indexes are synchronized so schema-defined indexes are applied
      try {
            const { Product } = await import('./models/product.model.js');
            await Product.syncIndexes();
            console.log('Product indexes synchronized');
      } catch (indexErr) {
            console.error('Failed to sync Product indexes:', indexErr);
      }
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
                        axios
                              .get(assetUrl)
                              .then(resp => {
                                    $(el).replaceWith(`<style>${resp.data}</style>`);
                              })
                              .catch(() => {
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
                        axios
                              .get(assetUrl)
                              .then(resp => {
                                    $(el).replaceWith(`<script>${resp.data}</script>`);
                              })
                              .catch(() => {
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
app.get('/api/product/v2/swagger-public', async (req, res) => {
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

app.use('/api/product/v2', productRouter);

app.listen(PORT, () => {
      console.log(`Products worker running on port ${PORT}`);
      console.log(`Swagger documentation available at http://localhost:${PORT}/api/product/v2/api-docs`);

      setTimeout(async () => {
            await generateSwaggerPublicHtml();
      }, 8000);
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
