import 'dotenv/config';
import '../cwd.js';

import express from 'express';
import minioRoutes from './minioRoutes.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { readFileSync } from 'fs';

const swaggerDocument = YAML.parse(readFileSync(cwd('minio/swagger.yaml'), 'utf8'));

const app = express();

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/', minioRoutes);

const PORT = 7004;
app.listen(PORT, () => {
      console.log(`MinIO worker running on port ${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
