import 'dotenv/config';
import '../cwd.js';

import express from 'express';
import minioRoutes from './minioRoutes.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { readFileSync } from 'fs';
import {load} from 'cheerio';
import axios from 'axios';

const swaggerDocument = YAML.parse(readFileSync(cwd('minio/swagger.yaml'), 'utf8'));
const swaggerEndPoint = "/api-docs";

const app = express();

let swaggerPublicHtml: string | null = null;
let swaggerPublicError: Error | null | unknown = null;

async function generateSwaggerPublicHtml() {
    try {
        const internalUrl = `http://localhost:${PORT}${swaggerEndPoint}`;
        const response = await axios.get(internalUrl);
        let html = response.data;
        const $ = load(html);

        // Inline <link rel="stylesheet" href="...">
        const linkPromises: any = [];
        $('link[rel="stylesheet"][href]').each((i, el) => {
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
        $('script[src]').each((i, el) => {
            const src = $(el).attr('src');
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

app.use(express.json());
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

app.use(swaggerEndPoint, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/', minioRoutes);

const PORT = 7004;
app.listen(PORT, () => {
      console.log(`MinIO worker running on port ${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}${swaggerEndPoint}`);

      setTimeout(async () => {
            await generateSwaggerPublicHtml();
        }, 8000);
});
