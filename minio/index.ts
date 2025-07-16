import 'dotenv/config';
import '../cwd.js';
import '../asyncHandler.js';

import express from 'express';
import minioRoutes from './minioRoutes.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { readFileSync } from 'fs';
import {load} from 'cheerio';
import axios from 'axios';
import { headMiddleware } from '../product/headMidd.js';
import mongoose from 'mongoose';
import morgan from 'morgan'; // If not installed: npm install morgan @types/morgan
import { minioService } from './minioService.js';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

// Extend Express Request type to include 'id'
declare module 'express-serve-static-core' {
    interface Request {
        id?: string;
    }
}

const swaggerDocument = YAML.parse(readFileSync(cwd('minio/swagger.yaml'), 'utf8'));
const swaggerEndPoint = "/api-docs";

const app = express();

// Attach a unique request id to each request
app.use((req: Request, _res, next) => {
    req.id = uuidv4();
    next();
});

// Custom morgan format for minio worker
morgan.token('id', req => (req as Request).id);
app.use(morgan('[minio] :id :method :url :status :response-time ms - :res[content-length]'));

// Add a catch-all error handler at the end
function errorHandler(err: any, _req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ message: 'Internal server error', error: err && err.message ? err.message : err });
}

let swaggerPublicHtml: string | null = null;
let swaggerPublicError: Error | null | unknown = null;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/minio';

async function connectToMongo() {
    await mongoose.connect(MONGO_URI).catch(err => {
          console.error('MongoDB connection error:', err);
          process.exit(1);
    });
    console.log('MongoDB connected for minio');
}

async function generateSwaggerPublicHtml() {
    try {
        const internalUrl = `http://localhost:${PORT}${swaggerEndPoint}`;
        const response = await axios.get(internalUrl);
        let html = response.data;
        const $ = load(html);

        // Inline <link rel="stylesheet" href="...">
        const linkPromises: any = [];
        $('link[rel="stylesheet"][href]').each((_i, el) => {
            const href: any = $(el).attr('href');
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
        const scriptPromises: any = [];
        $('script[src]').each((_i, el) => {
            const src: any = $(el).attr('src');
            let assetUrl = src;
            if (!/^https?:/.test(src!)) {
                assetUrl = `http://localhost:${PORT}${swaggerEndPoint}/${src.replace(/^\//, '')}`;
            }
            scriptPromises.push(
                axios.get(assetUrl!).then(resp => {
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

try {
    await minioService.checkMinioConnectionAndBucket();
} catch (err) {
    console.error('[startup] MinIO connection check failed:', err);
    process.exit(1);
}

// headMiddleware and routers
headMiddleware(app, express);

// Log all incoming requests to /swagger-public
app.get('/swagger-public', async (_req, res) => {
      try {
          if (swaggerPublicHtml) {
              res.send(swaggerPublicHtml);
          } else {
              res.status(500).send('Swagger UI not available.' + (swaggerPublicError ? ' ' + swaggerPublicError : ''));
          }
      } catch (err) {
          console.error('Error serving /swagger-public:', err);
          res.status(500).send('Failed to load Swagger UI');
      }
  });

app.use(swaggerEndPoint, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/', minioRoutes);

// Top-level error handler (should be after all routes)
app.use(errorHandler);

const PORT = 7004;
app.listen(PORT, () => {
      console.log(`MinIO worker running on port ${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}${swaggerEndPoint}`);

      setTimeout(async () => {
            await generateSwaggerPublicHtml();
        }, 8000);
});
