import express from 'express';
import minioRoutes from './minioRoutes.js';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
dotenv.config();

const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

const app = express();

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/minio', minioRoutes);

const PORT = process.env.MINIO_PORT_WORKER || 4001;
app.listen(PORT, () => {
  console.log(`MinIO worker running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);

}); 