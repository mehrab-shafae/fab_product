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

app.use('/api/product/v2', categoriesRouter);

app.listen(PORT, () => {
      console.log(`Categories worker running on port ${PORT}`);
      console.log(`Swagger documentation available at http://localhost:${PORT}/api/product/v2/api-docs`);

      setTimeout(async () => {
        
            await generateSwaggerPublicHtml();
        }, 5000);
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
